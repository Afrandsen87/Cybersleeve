# Cybersleeve

A cyberpunk idle/incremental game about re-sleeving your consciousness. Web app (installable PWA), TypeScript + Vite + Vitest, desktop browsers.

## Run it
```
npm install
npm run dev        # dev server (test aids are shown)
npm run check      # typecheck, Biome, tests, production build: run before finishing any change
npm test           # unit tests only
npm run docs       # regenerate docs/architecture.html (only when asked; the file is not in git)
```

## Where things are
| File | What it is |
|---|---|
| [DESIGN.md](DESIGN.md) | The game design: the source of truth for mechanics |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Modules, layering, tick loop, persistence |
| [docs/CONFIG.md](docs/CONFIG.md) | Every tuning variable in `src/content/gameConfig.ts` |
| `docs/architecture.html` | Generated overview (git-ignored, built on request) (functions, call graph, risks); open it in a browser |
| [CLAUDE.md](CLAUDE.md) | Standing engineering rules and the decisions log |

Add content and retune in `src/content/gameConfig.ts` only. Test aids (Reset save, Speed x10, Test drop) show in development builds or with `?debug` in the address.
