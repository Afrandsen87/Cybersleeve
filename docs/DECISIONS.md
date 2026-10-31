# Cybersleeve decisions log

Moved out of CLAUDE.md (2026-10-27) so the standing instructions stay small. The code and `DESIGN.md` describe what the game is now; this file records what the user decided and why. Read the relevant entry before changing that mechanic. Standing rules distilled from it are in CLAUDE.md.

Decided 2026-10-24 (by the user):

Decided 2026-10-24 (by the user, after the first full review):

Decided 2026-10-25 (by the user, after the second review):

Decided 2026-10-25 (by the user, after testing):

Decided 2026-10-25 (by the user, access ladder):

Decided 2026-10-25 (by the user, items):

Decided 2026-10-25 (by the user, after the performance review):

Decided 2026-10-25 (by the user, critical success):

Decided 2026-10-26 (by the user, Overclock, Focus and Burn leads):

Decided 2026-10-25 (by the user, icons):

Decided 2026-10-25 (by the user, Zero-days): Push malware gets the buyable *Zero-day exploits* (10,000 credits, placeholder), which lets its runs drop the item *Zero-day* (5%; no rarity, like the Burn lead; `sellable: false`). Clicking the Zero-day tile in the Inventory is a **toggle**: while on, every completed Push malware run uses one Zero-day up and is a critical success; the toggle switches itself off when none is left and cannot be switched on with none held. A batch of runs is settled in closed form (`min(runs, held)` guaranteed critical, the rest roll the normal chance). Configured by `items.zeroDay` (`{itemId, actionId}`); unit `core/zeroDays.ts`; the toggle is saved as `zeroDaysOn` and resets on re-sleeve.

Decided 2026-10-25 (by the user, Push malware crits): **Persistence** (Push malware, 500,000 credits, one time) triples what its critical successes do: both the reward and the action XP multipliers of the action's critical runs (effect `criticalBoost`; reading of "triples the critical success effect", confirm if only one was meant). **Ransomware** (Push malware, 100,000 placeholder) makes every critical Push malware run bank one guaranteed critical success for Grow network, spent by Grow network's next completed runs (effect `criticalLink`, state `bankedCriticals`, unit `core/criticalLinks.ts`). **Obfuscation** is a one-point skill that lowers Push malware's Overclock heat per run factor from 3 to 2 (effect `overclockHeatFactor`; replaced 2026-10-30 by `overclockHeatChanceFactor`, see actions.md). Zero-day exploits cost 5,000 credits.

Working conventions (in use):

Decided 2026-10-26 (by the user, Kill servers buyables): Kill servers gets five buyables and an Overclock. Prices (placeholders) climb in this order, each a few orders of magnitude above the one before: Cascade failure 1e10, Credit Siphon 1e12, Decommission protocol 1e14, Kill chain 1e17, Black box recorder 1e20. The Credit Siphon icon is the stylised credits chip with speed stripes behind it.

Decided 2026-10-26 (by the user, heat cooling): the skill **Purge Protocol** (1 skill point, placeholder) makes each heat cooldown cycle remove 1 more heat per SLEEVE level of Build Legend (effect `heatCooldownAmountFromSleeveLevel`, stat `heatCooldownAmount`). Cycles do not get faster: the cooldown stays in discrete steps, so it takes effect at once when unlocked. It is meant as a late-stage skill, part of removing the heat tax. A paid "Launder credits" cooling toggle is wanted later, tied into another system; not built.

Decided 2026-10-26 (by the user, re-sleeve points and synthetic sleeves): a re-sleeve gives one **re-sleeve point** (`resleeve.pointsPerResleeve`), spent on a **tree of re-sleeve skills** in its own group on the Skills tab (`currency: 'resleevePoints'`, `requires` draw the tree). Re-sleeve skills are kept through re-sleeving (`CARRIED_OVER_BUYABLE_CURRENCIES`), ordinary skills still reset. **Every sleeve-run is written down at re-sleeve, whatever skills are owned** (`GameState.runs`: the sleeve's OWN credits per second after the heat tax, never including synthetic income so nothing compounds, and the total of its action levels); a **Stats** tab lists the latest 10. The tree: **Sleeve Euphoria** (every action level needs `1 - 0.5^log10(that action's sleeve level)` less XP: 50% at level 10, 75% at 100; multiplies with flat reductions and is outside their cap), **Synthetic Sleeves** and **Incorporation** (both need Euphoria; Incorporation is a placeholder that does nothing). **Synthetic sleeves:** buying the skill gives one at once, copied from the last finished run, and each later re-sleeve gives one more, copied from the run that just ended; runs before the purchase are never copied; each sleeve keeps its own run's numbers. A sleeve earns `its run's credits per second x min(1, current action level total / that run's total)`, untaxed by heat and not multiplied by the credit lever again. The Network widget shows exactly two lines for them: the number of sleeves and their total credits per second. Upgrades that change the base behaviour (they stop being only a speed-up) are expected later.

Decided 2026-10-26 (by the user, after the full review):

Decided 2026-10-27 (by the user, Corporation and item tuning):

Decided 2026-10-27 (by the user, new Anonymity skills):

Decided 2026-10-27 (by the user, more re-sleeve skills):

Decided 2026-10-28 (by the user, balance and design knowledge):


## Where the entries are

Every decision entry now lives in the doc of the context it decides (section "Decisions"). Read that entry before changing the mechanic.

| Context | Entries |
|---|---|
| [actions](contexts/actions.md) | 11 |
| [app](contexts/app.md) | 16 |
| [automation](contexts/automation.md) | 1 |
| [config](contexts/config.md) | 2 |
| [corporation](contexts/corporation.md) | 3 |
| [crits](contexts/crits.md) | 2 |
| [economy](contexts/economy.md) | 1 |
| [effects](contexts/effects.md) | 6 |
| [engine](contexts/engine.md) | 2 |
| [general](contexts/general.md) | 5 |
| [heat](contexts/heat.md) | 5 |
| [items](contexts/items.md) | 6 |
| [kernel](contexts/kernel.md) | 5 |
| [resleeve](contexts/resleeve.md) | 6 |
| [save](contexts/save.md) | 2 |
| [skills](contexts/skills.md) | 4 |
| [synth](contexts/synth.md) | 1 |
| [ui](contexts/ui.md) | 8 |

*Group: Decided 2026-10-29/30 (by the user, S8 state and save)*
- **Automation: Pick Targets removed, resume checklists (2026-10-31).** Every Auto Burn switch is independent, so the Pick Targets skill is gone (lane slot 8 stays empty to keep saved skill ids stable); the resume switches turn on the Overclocks / Auto-runs the player ticks (`resumeOverclocks`, `resumeAutoRuns` in the wallet's Auto Burn settings), even ones switched off by hand. See [contexts/automation.md](contexts/automation.md).
- **Wallet / sleeve split, save v7.** `GameState = { wallet, sleeve }`. Wallet: credits, inventory, runs, synths, lastLifePurchases, automation (unchanged; a rework is planned), the corporation, and new all-time peak statistics. Sleeve: purchases, per-action state, network, heat, ICE Rating, Legend, Moles, `peakCredits`/`peakNetwork` (they drive the purchase reveal), the toggles, `keyToggles`. One migration function (flat v6 in, nested v7 out); only v7 is read afterwards. In memory there is one `state.sleeve` and one `wallet.corporation`; the SAVE already keeps them as keyed maps with one entry (`sleeves.main`, `wallet.corporations.main`), so a second sleeve or corporation needs no new save version. No assignment rule, no UI. The pre-migration save text is kept under `cybersleeve.save.premigration` until the next successful v7 save.

- **Balance:** the earlier "balance is not a factor yet, do not fix balance oddities" was meant loosely: the user accepts having to correct numbers later. It no longer applies literally because players are on the live game. Going forward, new content aims for sensible pacing (checked against existing prices, income and reveal thresholds), existing tuning is not rebalanced unasked, and an agent that sees a pacing problem reports it with numbers instead of silently fixing or ignoring it.
- **Genre knowledge lives in a skill** (`.claude/skills/incremental-design/`), loaded on demand for design work, so agents stop proposing generic game-design ideas. Reference games: Space Idle, Cookie Clicker (without the clicking), CIFI, ISEPS, Derivative Clicker, Revolution Idle (Steam), Underworld Idle.

*Group: Decided 2026-10-31 (reveal ledger)*
- **Reveal ledger.** `wallet.revealed: string[]`, used as a set, typed keys `stat:<id>`, `tab:<id>`, `skill:<id>`, `buyable:<id>`. Carried over a re-sleeve. Chosen over per-feature flags so every reveal rule has one reader (`RevealTracker`). Queries never mutate: the view build collects new keys (`ViewModel.newlyRevealed`) and the UI calls one engine command `noteRevealed(keys)` only when the list is non-empty, so the per-frame cost is a set lookup. A noted skill is readable but `locked` while its gates are unmet, a noted purchase is greyed (`gated`) and unbuyable; `Shop.isAvailable` stays the only buying gate. Unknown keys are dropped on load and by the command (ids resolve against the content). Tab blink uses earned-versus-seen counts held by the UI (`TabAttention`), not saved. The save version is not bumped here: a missing field loads empty; the migration piece `addRevealedLedger` is ready for the next bump.
- **Decided 2026-10-31 (by the user): the re-sleeve gate is a progress gate.** Replaces the sleeve-level threshold that rose by a fixed amount per re-sleeve. A re-sleeve needs this run's total ACTION levels and total SLEEVE levels to each beat the last run's by at least `resleeve.progressNeeded` (1 and 1), so every run has to go further than the one before in both. Each `SleeveRunRecord` keeps `sleeveLevelsTotal` next to `actionLevelsTotal`; the baseline is 0 before the first run. The Re-sleeve tab lists both requirements. Save: the new record field reads as 0 when absent; `migrateProgressionSave` (`core/resleeve/progressGate.ts`) gives the newest record the current sleeve-level total and drops the retired Rarity refinement purchase; the version bump is wired by the orchestrator. Related same-day changes: skill points come from content `skills: { earlyThresholds: [1, 5], every: 10 }` (points at totals 1, 5, 10, 20, 30...), every re-sleeve skill costs 1 point, Faster conditioning grows 10x per copy (was 100x), and Rarity refinement is a Leverage skill (1 skill point).
- **Decided 2026-10-31 (by the user): the ICE Rating curve is concave.** Heat reduction = `min(1, (orders / iceRatingOrdersForFullReduction) ^ iceRatingReductionExponent)` with orders = log10(ICE Rating), 100 and 0.5 in real content (`concaveShare` in `kernel/curves.ts`; replaces `iceRatingReductionPerOrder`, a straight 1% per order). The first orders count the most (1e4 removes 20% instead of 4%) while the full effect still needs 1e100, so early ICE matters and the end stays far away.
- **Decided 2026-10-31 (by the user, after trying it): the ICE curve is less concave.** The exponent is 0.75, not 0.5: the square root rose too fast at the start and then stood still, because ICE Rating does not grow that fast. 1e4 now removes about 9%, 1e20 about 30%; only the content value changed.

- **Decided 2026-10-31 (by the user): Burn leads show by price alone.** The Overclock gate was removed. Owning the Burn lead drop counts as discovering heat (`statReveal.ts`, `ownsBurnLeadDrop`), so heat and ICE Rating show at once. The Sleeve levels purchase is renamed Sleeve Theory (id unchanged) with a one-line tip.
- **Decided 2026-10-31 (by the user): one look for purchase states.** First purchase available: blue border, glow, full-colour icon. Bought again-able: teal border, icon dimmed; teal glow and full colour while a copy is affordable. No more copies (or a bought toggle): gold border, full colour, unlit; a toggle that is on glows gold. The glow always matches the border colour.

- **Decided 2026-10-31 (by the user): the sleeve skills are restructured and refunded.** The "re-sleeve skills" are now the **sleeve skills**, paid in **sleeve skill points** (identifiers such as `resleevePoints` keep their names). New root **Sleeve Up!** (id `skill-sleeve-up`, 1 point, no gate, branch `sleeveUp`, marker effect `sleeveUp`) is the parent of all four lane roots; the config validator allows a parent in another branch only when that branch is a trunk (one parentless skill alone). The purchases that appear from the second sleeve on (Skill transfer, Study methods, Faster conditioning) now unlock by the NUMBER of sleeve skills owned (`requiresSleeveSkills: 1`, owned by Sleeve Up!), replacing the count of finished runs (`revealAfterResleeves`, removed). In the sleeve tree a skill reads ??? until the skill before it is OWNED (`parentsMustBeOwned`); the normal skill tree keeps its rule. The sleeve tree is drawn as one joined tree (lanes against each other, Sleeve Up! centred in the first column). The full tree now takes 39 re-sleeves (was 38); balance is left alone.
- **Decided 2026-10-31 (by the user): save v10 refunds every sleeve skill.** A save of any older version (6 to 9) loses all owned sleeve skills at load (`migrateV9`, `save/migrateV10.ts`; the ids come from the config) and their reveal-ledger keys, so the points come back (they are derived) and the ??? rule applies again. It runs on the saved text, before the reader clamps capped copies. The synthetic sleeves and the run records stay saved: `readSynths` no longer needs the skill, `SynthSleeves.count()` and the income read 0 while Synthetic Sleeves is unowned, and buying it again gives a first sleeve only when there are none, so the old income returns with no duplicate. Known and accepted: a refunded save with a running corporation action keeps ticking it while Incorporation is unowned (one time only, allowed by the user); Hive Interface and Neural Mirror read the raw synth list (unreachable without Synthetic Sleeves, their ancestor).
- **Decided 2026-10-31 (by the user): a real simulator is needed.** Minor performance and balance questions (for example how often `Shop.isAvailable` runs per frame for gated buyables) are not chased until an actual simulator exists to measure them; until then such issues are noted and left, not optimised on a guess.
- **Decided 2026-10-31 (by the user): the currency registry owns "sleeve skill".** `kernel/currencies.ts` flags the `resleevePoints` descriptor (`sleeveSkills`) and exports `isSleeveSkill(buyable)` and `sleeveSkillIds(buyables)`; the shop (`requiresSleeveSkills`), config validation, the v10 refund (`app/persistence.ts`), the Skills view and the tests all ask these instead of comparing the currency name.

- **Decided 2026-10-31 (by the user, supersedes the earlier progress gate):** re-sleeving needs total sleeve levels of **5 + the number of earlier re-sleeves**. No action-level requirement or comparison with last-run totals remains. Config: `progressNeeded: { sleeveLevels: 5, perResleeve: 1 }`; omitted means no gate. Existing records and sleeve levels suffice; save format and migrations are unchanged. Action speed now gains **1% per action level** and action XP costs grow by **1.2**, with the first cost and sleeve-level curves unchanged. Intent: higher skill levels so level-based effects matter.

- **Decided 2026-10-31 (by the user, effective levels): level bonuses are effective levels for all derived calculations.** Skill Transfer and Networked Sleeve add to real levels through one owner. Speed, reward factors, network growth, level-based ICE and start-cost reductions use the result. XP/leveling, real Lv labels, skill-point totals, re-sleeve gates and Neural Mirror's XP catch-up comparison retain real progression. Cloaking is explicitly carried through its effect trait without widening currency carry rules.

- **Decided 2026-10-31 (by the user, Kompromat automation):** Autosale is per-rarity skill-gated; auto Back Channel is added on its upper fork and reuses the manual BackChannel batch owner before autosale. Stable slots 1 to 8 remain; placeholders 9/10 are removed and their points return through the known-id purchase filter and derived accounting. The one-effect root keeps unlocksAutomation with optional allowsAutosale; the existing first-parent layout draws the fork. The new wallet switch map is additive and follows Daemon Persistence; no migration or save version change.

- **Decided 2026-10-31 (by the user, Augment dispersal):** replace percentage shares with selected actions and a nine-node chain. The unlock grants common rarity and one target; five later slots expand selection to six, and three grant uncommon, rare and legendary permission. Stable ids 1 to 9 remain; removed slot 10 refunds through derived points. The new wallet automation field is dispersalTargets; the old dispersal key is ignored, clearing selections without changing an existing field meaning or save version. Daemon Persistence carries the new settings with the automation block. Equal weights reuse the existing balancing and largest-remainder split.
