# Context docs

One file per bounded context: its design text, architecture notes, config variables and decision history, moved verbatim from `DESIGN.md`, `docs/ARCHITECTURE.md`, `docs/CONFIG.md` and `docs/DECISIONS.md`. Load only the slice for the context you change. Code folders: `src/core/<context>/`; target map: `docs/review/target-architecture.md`.

| Context | Responsibility | Size |
|---|---|---|
| [kernel](kernel.md) | Number safety: BigNum adapter use, Infinity (1e308) clamping, sampling, curves, memo cache. | 3.8 KB |
| [config](config.md) | Configuration types and their validation. | 0.8 KB |
| [effects](effects.md) | Buyable effect kinds, the effect registry, traits and the resolved effect queries. | 17.9 KB |
| [actions](actions.md) | Actions: definitions, runner, toggles, speed, levels and XP, rewards, Overclock and Focus. | 29.9 KB |
| [heat](heat.md) | Heat: gain, tax, cooldown cycle, Moles, Legend speed-up. | 1.9 KB |
| [crits](crits.md) | Critical successes, Zero-days, Admin keys, links. | 3.5 KB |
| [items](items.md) | Items, rarities, drops, the Inventory, Burn leads, Skill shards, Augments, Back channel. | 14.4 KB |
| [economy](economy.md) | Credits, network nodes, passive income, the shop and price growth, purchase reveal. | 6.6 KB |
| [skills](skills.md) | Skill trees and skill points. | 12.6 KB |
| [automation](automation.md) | Automation points, lanes and features. | 4.7 KB |
| [sleeve](sleeve.md) | Sleeve stats: access level, ICE Rating, Hacking Proficiency, sleeve levels, Sleeve Euphoria. | 5.2 KB |
| [resleeve](resleeve.md) | Re-sleeving (first prestige): gate, carry-over lists, run record, re-sleeve skills. | 17.0 KB |
| [synth](synth.md) | Synthetic sleeves: copies of finished runs. | 0.8 KB |
| [corporation](corporation.md) | The Corporation: actions, levels, stocks, rank. | 10.9 KB |
| [save](save.md) | Save format, state lifetimes, serialization and versions. | 5.0 KB |
| [engine](engine.md) | Tick loop, engine facade, queries and commands, time. | 10.6 KB |
| [ui](ui.md) | Rendering, view models, text, tooltips, layout. | 4.0 KB |
| [app](app.md) | Composition, loop, hosting, deploy, tooling and process. | 4.2 KB |
| [general](general.md) | Cross-cutting decisions that fit no single context. | 1.1 KB |

Also: [_layering.md](_layering.md) holds the layering diagram and the long per-folder notes until each context step has taken its share.
