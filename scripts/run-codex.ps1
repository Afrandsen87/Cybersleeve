# Runs one Codex implementation package non-interactively inside a task worktree.
# Usage: pwsh scripts/run-codex.ps1 -Worktree <dir> -Spec <spec.md> -Report <report.md> [-Model <name>]
# Reads the spec file as the prompt, lets Codex write inside the worktree only, and saves its final message
# to the report file. Codex commits with the allowed git commands only. Never pushes; the sandbox has no network.
# Finding codex: $env:CODEX_BIN, then PATH, then the newest binary bundled with the VS Code extension
# (the folder name changes with every extension update).
# Called by: the codex-task skill. Calls: `codex exec` (flags checked against codex-cli 0.164).
param(
  [Parameter(Mandatory)][string]$Worktree,
  [Parameter(Mandatory)][string]$Spec,
  [Parameter(Mandatory)][string]$Report,
  [string]$Model
)
$ErrorActionPreference = 'Stop'

function Find-Codex {
  if ($env:CODEX_BIN -and (Test-Path $env:CODEX_BIN)) { return $env:CODEX_BIN }
  $onPath = Get-Command codex -ErrorAction SilentlyContinue
  if ($onPath) { return $onPath.Source }
  $bundled = Get-ChildItem "$env:USERPROFILE\.vscode\extensions\openai.chatgpt-*\bin\windows-x86_64\codex.exe" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($bundled) { return $bundled.FullName }
  throw 'codex not found: set CODEX_BIN, add it to PATH, or install the OpenAI VS Code extension.'
}

if (-not (Test-Path $Spec)) { throw "Spec file not found: $Spec" }
if (-not (Test-Path (Join-Path $Worktree '.git'))) { throw "Not a git worktree: $Worktree" }

# Dependencies: the sandbox has no network, so node_modules must exist before Codex starts. Reuse the primary
# checkout's through a junction when package-lock.json is identical; otherwise run a real `npm install`.
# Remove the junction (`cmd /c rmdir <worktree>\node_modules`) BEFORE deleting the worktree, never with Remove-Item -Recurse.
$primary = (Split-Path -Parent (git -C $Worktree rev-parse --path-format=absolute --git-common-dir)).Trim()
if (-not (Test-Path (Join-Path $Worktree 'node_modules'))) {
  $sameLock = (Get-FileHash (Join-Path $Worktree 'package-lock.json')).Hash -eq (Get-FileHash (Join-Path $primary 'package-lock.json')).Hash
  if ($sameLock -and (Test-Path (Join-Path $primary 'node_modules'))) {
    New-Item -ItemType Junction -Path (Join-Path $Worktree 'node_modules') -Target (Join-Path $primary 'node_modules') | Out-Null
    Write-Host 'node_modules linked from the primary checkout.'
  } else {
    Push-Location $Worktree; npm install; Pop-Location
  }
}

# The sandbox keeps .git read-only (`index.lock: Permission denied`, even with --add-dir). Git therefore runs outside
# it through the execpolicy rules in scripts/codex-git.rules (add, commit, status, diff, log only; never push),
# which Codex reaches by escalating under approval_policy on-request.
$rules = Join-Path $env:USERPROFILE '.codex\rules\cybersleeve-git.rules'
if (-not (Test-Path $rules)) { throw "Missing ${rules}: copy scripts/codex-git.rules there (UTF-8 without BOM)." }
$codexArgs = @('exec', '--cd', $Worktree, '--sandbox', 'workspace-write', '-c', 'approval_policy="on-request"', '--output-last-message', $Report)
if ($Model) { $codexArgs += @('--model', $Model) }

# The trailing `-` makes codex read the prompt from stdin.
Get-Content -Raw $Spec | & (Find-Codex) @codexArgs -
$codexExit = $LASTEXITCODE
# The elevated sandbox creates files owned by its own account; grant the current user control now so later
# edits, `npm run check` and worktree removal do not hit permission errors. The node_modules junction is skipped.
Get-ChildItem $Worktree -Force | Where-Object { $_.Name -ne 'node_modules' } | ForEach-Object {
  icacls $_.FullName /grant "${env:USERNAME}:(OI)(CI)F" /t /c /q 2>&1 | Out-Null
}
if ($codexExit -ne 0) { throw "codex exec exited with $codexExit" }
Write-Host "Codex finished. Report: $Report"
