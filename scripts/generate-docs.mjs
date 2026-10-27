// Generates docs/architecture.html from the source code (TSDoc comments, imports) and a real test run.
// Usage: npm run docs          (writes docs/architecture.html, runs the tests)
//        npm run docs:check    (writes nothing: fails when docs/architecture.html no longer matches the sources; not part of `npm run check`, run on request only)
//
// Extracted automatically: files, @module descriptions, import graph, exported symbols + class
// members with their TSDoc (summary, @param, @returns, @throws, "Called by:", "Calls:"), documentation
// coverage, test results (runs Vitest). Curated explanations live in scripts/architecture.template.html.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript5';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src');
const toPosix = (p) => p.split(sep).join('/');
const CHECK = process.argv.includes('--check');

/* ---------- collect files ---------- */
function walk(dir) {
  const out = [];
  // Sorted by code unit: the OS listing order differs between Windows and Linux, and the output must not.
  for (const name of readdirSync(dir).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}
const allFiles = walk(srcDir).map((f) => toPosix(relative(srcDir, f)));
const sourceFiles = allFiles.filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.startsWith('testing/'));
const testFiles = allFiles.filter((f) => f.endsWith('.test.ts'));

/* ---------- TSDoc parsing ---------- */
function cleanDocLines(raw) {
  return raw
    .map((l) =>
      l
        .replace(/^\s*\/\*\*\s?/, '')
        .replace(/\s*\*\/\s*$/, '')
        .replace(/^\s*\*\s?/, ''),
    )
    .map((l) => l.replace(/\s+$/, ''));
}

function parseDoc(block) {
  if (!block) return null;
  const lines = cleanDocLines(block);
  const doc = { summary: '', remarks: '', params: [], returns: '', throws: '', calledBy: '', calls: '' };
  let section = 'summary';
  let currentTag = null;
  const buf = { summary: [], remarks: [] };
  for (const line of lines) {
    const tag = line.match(/^@(\w+)\s*(.*)$/);
    if (tag) {
      const [, name, rest] = tag;
      currentTag = null;
      if (name === 'param') {
        const m = rest.match(/^(\S+)\s*(.*)$/);
        const p = { name: m ? m[1] : rest, text: m ? m[2] : '' };
        doc.params.push(p);
        currentTag = p;
      } else if (name === 'returns' || name === 'return') {
        doc.returns = rest;
        currentTag = { ref: 'returns' };
      } else if (name === 'throws') {
        doc.throws = rest;
        currentTag = { ref: 'throws' };
      } else if (name === 'remarks') {
        section = 'remarks';
        if (rest) buf.remarks.push(rest);
      } else if (name === 'module' || name === 'packageDocumentation') {
        section = 'module';
        if (rest) buf.summary.push(rest);
      } else section = 'other';
      continue;
    }
    if (currentTag) {
      if (line.trim() === '') {
        currentTag = null;
        continue;
      }
      if (currentTag.ref) doc[currentTag.ref] += ' ' + line.trim();
      else currentTag.text += ' ' + line.trim();
      continue;
    }
    const cb = line.match(/^Called by:\s*(.*)$/);
    const cs = line.match(/^Calls:\s*(.*)$/);
    if (cb) {
      doc.calledBy = cb[1].trim();
      continue;
    }
    if (cs) {
      doc.calls = cs[1].trim();
      continue;
    }
    if (section === 'summary' || section === 'module') buf.summary.push(line);
    else if (section === 'remarks') buf.remarks.push(line);
  }
  const tidy = (arr) =>
    arr
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  doc.summary = tidy(buf.summary);
  doc.remarks = tidy(buf.remarks);
  return doc;
}

/* ---------- symbol and import extraction (TypeScript compiler API) ---------- */
// The project compiles with TypeScript 7 (native), which has no JavaScript API, so parsing uses an aliased
// TypeScript 5 (`typescript5` in devDependencies). It is only used here, to read syntax; nothing is compiled with it.

/** The doc comment (a block starting with two asterisks) directly before a node, as raw lines for parseDoc; null when there is none. */
function docOf(node, text) {
  const ranges = ts.getLeadingCommentRanges(text, node.getFullStart()) ?? [];
  const docs = ranges.filter((r) => text.startsWith('/**', r.pos));
  const last = docs[docs.length - 1];
  return last ? text.slice(last.pos, last.end).split(/\r?\n/) : null;
}

const hasModifier = (node, kind) => (ts.getModifiers(node) ?? []).some((m) => m.kind === kind);
const squash = (s, max = 220) => {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
};

function extractSymbols(file, text) {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const symbols = [];
  let moduleDoc = '';

  // Module description: the first doc block containing @module.
  for (const block of text.match(/\/\*\*[\s\S]*?\*\//g) || []) {
    if (/@module|@packageDocumentation/.test(block)) {
      const d = parseDoc(block.split(/\r?\n/));
      moduleDoc = [d.summary, d.remarks].filter(Boolean).join('\n\n');
      break;
    }
  }

  /** Records one declaration. `header` is the source text of its signature (without the body). */
  const add = (node, kind, name, owner, exported, header) => {
    if (!exported && owner === null && ['const', 'interface', 'type', 'enum'].includes(kind)) return; // private module data is not documented API
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    symbols.push({ file, kind, name, owner, exported, signature: squash(header), line, doc: parseDoc(docOf(node, text)) });
  };
  /** Source text from the start of a node to the start of its body. */
  const headerOf = (node, body) => text.slice(node.getStart(sf), body ? body.getStart(sf) : node.getEnd());

  for (const node of sf.statements) {
    const exported = hasModifier(node, ts.SyntaxKind.ExportKeyword);
    if (ts.isFunctionDeclaration(node) && node.name) {
      add(node, 'function', node.name.text, null, exported, headerOf(node, node.body));
    } else if (ts.isInterfaceDeclaration(node)) {
      add(node, 'interface', node.name.text, null, exported, headerOf(node, node.members[0] ?? undefined).replace(/\{\s*$/, ''));
    } else if (ts.isTypeAliasDeclaration(node)) {
      add(node, 'type', node.name.text, null, exported, `${exported ? 'export ' : ''}type ${node.name.text}`);
    } else if (ts.isEnumDeclaration(node)) {
      add(node, 'enum', node.name.text, null, exported, `${exported ? 'export ' : ''}enum ${node.name.text}`);
    } else if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue;
        const type = decl.type ? `: ${decl.type.getText(sf)}` : '';
        add(node, 'const', decl.name.text, null, exported, `${exported ? 'export ' : ''}const ${decl.name.text}${type}`);
      }
    } else if (ts.isClassDeclaration(node) && node.name) {
      const cls = node.name.text;
      add(node, 'class', cls, null, exported, headerOf(node, node.members[0] ?? undefined).replace(/\{\s*$/, ''));
      for (const member of node.members) {
        // Members of a class that is not exported are not public API; `private` members are never public.
        const isPublic = exported && !hasModifier(member, ts.SyntaxKind.PrivateKeyword) && !ts.isPrivateIdentifier(member.name ?? member);
        const nameOf = (m) => (m.name ? m.name.getText(sf) : '');
        if (ts.isConstructorDeclaration(member)) {
          add(member, 'constructor', 'constructor', cls, isPublic, 'constructor(...)');
        } else if (ts.isMethodDeclaration(member)) {
          add(member, 'method', nameOf(member), cls, isPublic, headerOf(member, member.body));
        } else if (ts.isGetAccessorDeclaration(member)) {
          add(member, 'getter', nameOf(member), cls, isPublic, headerOf(member, member.body));
        } else if (
          ts.isPropertyDeclaration(member) &&
          member.initializer &&
          (ts.isArrowFunction(member.initializer) || ts.isFunctionExpression(member.initializer))
        ) {
          add(member, 'method', nameOf(member), cls, isPublic, headerOf(member, member.initializer.body));
        }
      }
    }
  }
  return { moduleDoc, symbols };
}

/* ---------- imports ---------- */
function resolveImport(fromFile, spec) {
  if (!spec.startsWith('.')) return null;
  const base = posix.normalize(posix.join(posix.dirname(fromFile), spec));
  const cands = [`${base}.ts`, `${base}/index.ts`, base];
  return cands.find((c) => sourceFiles.includes(c)) ?? null;
}

function extractImports(file, text) {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const out = new Map();
  for (const node of sf.statements) {
    const isImport = ts.isImportDeclaration(node);
    const isReexport = ts.isExportDeclaration(node);
    if (!(isImport || isReexport) || !node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) continue;
    const spec = node.moduleSpecifier.text;
    const target = resolveImport(file, spec);
    const key = target ?? spec;
    if (!out.has(key)) out.set(key, { target, external: !spec.startsWith('.'), spec, reexport: isReexport });
    else if (isImport) out.get(key).reexport = false;
  }
  return [...out.values()];
}

/* ---------- build file records ---------- */
const files = sourceFiles.map((f) => {
  const text = readFileSync(join(srcDir, f), 'utf8');
  const { moduleDoc, symbols } = extractSymbols(f, text);
  return {
    path: f,
    module: f.includes('/') ? f.split('/')[0] : '(entry)',
    lines: text.split(/\r?\n/).length,
    moduleDoc,
    imports: extractImports(f, text),
    symbols,
  };
});

// CSS counts as a source file for the file table only.
const cssFiles = allFiles
  .filter((f) => f.endsWith('.css'))
  .map((f) => ({
    path: f,
    lines: readFileSync(join(srcDir, f), 'utf8').split(/\r?\n/).length,
  }));

/* ---------- tests: run vitest ---------- */
let tests = { ran: false, total: 0, passed: 0, failed: 0, files: [] };
const tmpOut = join(root, 'tmp-vitest-docs.json');
try {
  if (!CHECK) {
    try {
      execSync(`npx vitest run --reporter=json --outputFile="${tmpOut}"`, { cwd: root, stdio: 'ignore' });
    } catch {
      /* a failing test still writes the report */
    }
    if (existsSync(tmpOut)) {
      const r = JSON.parse(readFileSync(tmpOut, 'utf8'));
      tests = {
        ran: true,
        total: r.numTotalTests,
        passed: r.numPassedTests,
        failed: r.numFailedTests,
        files: r.testResults.map((tr) => {
          const rel = toPosix(relative(srcDir, tr.name.replace(/\//g, sep)));
          const groups = new Map();
          for (const a of tr.assertionResults) {
            const g = a.ancestorTitles.join(' > ') || '(top level)';
            const e = groups.get(g) ?? { name: g, tests: [] };
            e.tests.push({ title: a.title, status: a.status });
            groups.set(g, e);
          }
          return { file: rel, groups: [...groups.values()] };
        }),
      };
    }
  }
} finally {
  rmSync(tmpOut, { force: true });
}

/* ---------- stats ---------- */
const exported = files.flatMap((f) => f.symbols).filter((s) => s.exported);
const documented = exported.filter((s) => s.doc?.summary);
const data = {
  generatedAt: new Date().toISOString(),
  packageVersion: JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version,
  files,
  cssFiles,
  testFiles,
  tests,
  coverage: { exported: exported.length, documented: documented.length },
  undocumented: exported.filter((s) => !s.doc?.summary).map((s) => `${s.file}: ${s.owner ? s.owner + '.' : ''}${s.name}`),
};

/* ---------- write html ---------- */
const template = readFileSync(join(root, 'scripts', 'architecture.template.html'), 'utf8');
const json = JSON.stringify(data).replace(/</g, '\\u003c');
const html = template.replace('"__DATA__"', json);

if (CHECK) {
  // Compare everything the sources determine; the generation time and the test results are not part of the comparison.
  const target = join(root, 'docs', 'architecture.html');
  const [head, tail] = template.split('"__DATA__"');
  const stale = (why) => {
    console.error(`docs/architecture.html is stale (${why}). Run \`npm run docs\` and include the result in the change.`);
    process.exit(1);
  };
  if (!existsSync(target)) stale('it does not exist');
  const existing = readFileSync(target, 'utf8');
  if (!existing.startsWith(head) || !existing.endsWith(tail)) stale('the curated sections in scripts/architecture.template.html changed');
  const old = JSON.parse(existing.slice(head.length, existing.length - tail.length));
  const comparable = (d) => JSON.stringify({ ...d, generatedAt: '', tests: null });
  if (comparable(old) !== comparable(data)) stale('the sources, tests or their documentation changed');
  console.log('docs/architecture.html is up to date.');
  process.exit(0);
}

mkdirSync(join(root, 'docs'), { recursive: true });
writeFileSync(join(root, 'docs', 'architecture.html'), html);
console.log(
  `docs/architecture.html written: ${files.length} files, ${files.reduce((n, f) => n + f.symbols.length, 0)} symbols, ` +
    `doc coverage ${documented.length}/${exported.length} exported, tests ${tests.passed}/${tests.total} passing.`,
);
if (data.undocumented.length) console.warn('Undocumented exports:\n  ' + data.undocumented.join('\n  '));
