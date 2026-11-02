# Context: skills (planned Firmware redesign)

**Status: rough mechanical design for Cybernetics, Leverage and Sleeve Firmware, agreed with the user 2026-11-02. Not built.** This page describes a target, not the game as it is; `skills.md` and the code stay the source of truth for what exists.

**Before writing any player-facing text** (names may stay, descriptions, tooltips, reveal wording) for these skills, rebase onto the user's heat and burn redesign from the other branch and follow its updated guidance. The heat redesign also changes the Anonymity tree (frozen, see below) and the heat parts of Puppet Strings. All numbers below are placeholders; point-gain calibration comes after the skills are in.

## Goals

- What a player specs into should change how the run plays. Skills get stronger the deeper they sit: depth 2 to 3 are plain multipliers on one thing, 4 to 6 bend a rule or add a condition, 7 to 8 are lane capstones that change how a run is played.
- Each tree has thematic **lanes** (one aspect of the sleeve each) and **joins**: a join needs BOTH parents, sits around depth 5 to 6 between two lanes, and its effect is the conceptual mix of the two themes. Joins are optional side nodes: the lanes continue past them, so a player takes a join early (and goes less deep) or later with spare points.
- Trees about twice as deep as before (lanes about 8 from the root).
- **Costs:** 1 point per skill, **2 per join, 3 per capstone**.
- Point-gain target (calibrated last): fast until roughly one lane to the bottom, then noticeably (not much) slower; by the time all Sleeve Firmware is owned, all Firmware should be reachable, and the player is in the corporate phase. Today points come at total action levels 1, 5, 10, 20, 30, ... (`skills` in `gameConfig.ts`); the slowdown may come from levels alone or from a new scaling, undecided.
- Layout: trees will grow top to bottom (separate UI task, together with the inspector), so join edges cross lanes.

Marked * = new skill. Existing skills keep their effect unless stated.

## Cybernetics (the body as hardware): about 43 points

Root: Overclocked Cortex. Lanes form a ring: Reflexes, Precision, Throughput, Learning, each joined to its neighbours.

| Depth | Reflexes (speed, Overclock, Focus) | Precision (critical successes) | Throughput (nodes, Grow network) | Learning (XP, Hacking Proficiency) |
|---|---|---|---|---|
| 2 | Parallel Threads | Signal Amplifier (moves here from under Bandwidth Leech) | Bandwidth Leech | Muscle Memory |
| 3 | Neural Accelerant | Overdrive Spike | Fiber Tap | Quick Study |
| 4 | *Adrenal Shunt: Focus speed bonus 25% to 40% | *Target Lock: focused actions +25% critical chance | Backbone Parasite | *Pattern Recognition: Practice Hacking's proficiency reward x1.5 |
| 5 | *Hot-Swap Synapses: every Overclock's gains +25% of base (stacks with the Overclock upgrade) | *Cascade: Signal Amplifier's extra critical can bring another (repeating, closed form) | *Dark Fiber: Grow network runs 10% chance to also pay a Push malware reward | *Peer Tutoring: Practice Hacking runs give 1 action XP to the lowest-level unlocked action that is above level 1 (no progress on an action never run) |
| 6 | *Second Spine: +1 Focus slot | *Weak Point: critical chance above 100% counts double | *Mesh Topology: node payout x(1 + 5% per order of magnitude of nodes) | *Polymath: Hacking Proficiency +2% per 10 total action levels |
| 7 | **Time Dilation*** (capstone): interface speed x1.1 per Focus slot in use | *Exploit Forge: Push malware critical successes 2% chance to drop a Zero-day | *Traffic Shaping: Push malware reward x2 | **Savant*** (capstone): action level XP growth 1.2 to 1.18 |
| 8 | | **Perfect Execution*** (capstone): each critical success's reward gets +x1 per whole 100% critical chance | **Self-Replicating Botnet*** (capstone): each Grow network run also adds 0.01% of nodes held (compounding, closed form) | |

Joins (2 points each):
- Reflexes x Precision: **Bullet Time**, +5% critical chance per doubling of interface speed.
- Precision x Throughput: **Packet Storm**, linked payouts (Fiber Tap, Dark Fiber, Overclock `alsoPays`) can be critical successes.
- Throughput x Learning: **Distributed Cognition**, Hacking Proficiency gain x(1 + log10(nodes) / 20).
- Learning x Reflexes: **Myelin Rewrite**, action levels give +1.5% speed each instead of +1%.

Notes for balance: Precision stacks many criticals; if criticals become a flat multiplier on everything, fix what a critical does, not these skills. Savant feeds firmware points (more action levels); the user accepts it because Learning gives no payout. Watch Self-Replicating Botnet's growth in play. Shard Resonance (choose where a Skill shard lands) was dropped from Learning: shards come late (Black box recorder, Admin keys, 2% per key critical); it may return as a later shard skill.

## Leverage (dirt on everyone): about 45 points

Root: Nose for Secrets. Four lanes. **Files cashed in this life** (sold plus back-channelled, per rarity, a new per-sleeve counter reset by re-sleeving) drives Kingmaker, Favours Owed and Coercion, so the lanes keep working with auto sell or auto back channel on for everything (no micromanagement at the endgame).

| Depth | Harvest (more, rarer files) | Extortion (files into income) | Informants (back channel, Moles) | Coercion* (others carry your costs) |
|---|---|---|---|---|
| 2 | Deep Files | Exploit Kompromat | Back Channel Deals | *Leaned-On Sysadmin: Kill servers takes 20% less of its node share per start |
| 3 | Sealed Archives | Dossier | Tiered Informants | *Hush Fund: Practice Hacking's Overclock costs 3 nodes per run instead of 5 |
| 4 | Black Ledger | *Shakedown: files sell for twice the seconds of income | Double Agent | *Captive Talent: Practice Hacking reward x(1 + 5% per order of magnitude of files cashed in) |
| 5 | Rarity refinement | *Hush Money: each held common and uncommon file +0.1% node payout | Deep Cover | *Compromised Vendor: Grow network reward x(1 + 5% per order of magnitude of files cashed in) |
| 6 | *Data Broker: Push malware also drops Kompromat | *Favours Owed: credit-paid upgrade prices are raised to the power (1 - 1% per order of magnitude of files cashed in), exponent at least 0.5 (1e6 files: 1e30 becomes about 1e28.2) | *Handler: back channel also pays 1 Burn lead per 10 files | *Fixer: Kill chain links no longer raise the node share |
| 7 | *Insider: Rarity refinement moves 8% per step instead of 5% | **Kingmaker*** (capstone): sold and back-channelled files keep counting for Exploit Kompromat, Dossier and Hush Money at 25% of a held file's weight | *Mole Hunt: ICE Rating gain x(1 + 5% per order of magnitude of Moles) | **Puppet Strings*** (capstone): every Overclock cost (nodes, heat, heat chance) falls 2% per order of magnitude of files cashed in, compounding (heat part waits for the heat redesign) |
| 8 | **Panopticon*** (capstone): every Kompromat drop comes one rarity higher | | **Deep State*** (capstone): Moles also lower the heat tax by 1% per order of magnitude | |

Joins (2 points each):
- Harvest x Extortion: **Opposition Research**, sell price +10% per Rarity refinement step.
- Extortion x Informants: **Protection Racket**, back-channelled files also pay 25% of their sale price in credits.
- Informants x Harvest: **Wiretap**, Kompromat drop chance +5% per order of magnitude of Moles.
- Informants x Coercion: **Turned Asset**, Moles count as cashed-in files for Coercion (1 file per 10 Moles).
- Harvest x Coercion: **Server Autopsy**, Kill servers runs also drop Kompromat, weighted one rarity higher.

No Leverage capstone depends on a crisis-level drop (vision anti-goal). Rejected: Pressure Campaign (cheaper Access upgrades; access comes fast anyway); Favours Owed as a percentage cut (x0.9 per order still leaves a price in the same order of magnitude).

## Anonymity: frozen

Wait for the heat and burn redesign from the other branch; it changes what heat, burning and "running hot" mean. Kept from this round as direction only:
- Lanes Countermeasures, Burn, Silence and a heat-as-resource lane (Running Hot), with joins between them.
- Wildfire and Pyromancer were rejected as far too strong (bonuses on heat held or peak heat). Burn capstones should scale with how often you burn, not how much heat is removed.
- Running Hot must stay meaningful at the endgame and work with the cooling lanes: pay on heat made or on heat tax avoided, not on heat held, so owning both lanes stacks instead of cancelling.
- Blackout's parent is Purge Protocol only (the code is right; an older note naming three parents is wrong).

## Sleeve Firmware (persistent, one point per re-sleeve): about 42 skills

Every sleeve skill costs **1 point** (joins and capstones too: points come once per re-sleeve, and a re-sleeve without a new skill feels bad). Target 30 to 50 skills, each meaningful; the tree size sets how many re-sleeves the game has before the corporation takes over. Strength still rises with depth. Sleeve Up! stays the trunk. **Carry-overs and price cuts work in orders of magnitude** (see the Numbers rule in `CLAUDE.md`).

| Depth | Retention (what the mind keeps) | Reach (the sleeve's limits) | Synthetics (copies of past lives) | Capital* (money that outlives the body) |
|---|---|---|---|---|
| 1 | Reflex Archive | Sleeve Euphoria | Synthetic Sleeves | *Offshore Account: start each life with 10^(k x orders of last life's peak credits), k = 10% (placeholder; the user first said 1%) |
| 2 | Daemon Persistence | Deep Conditioning | Cloning Vats | *Pension Fund: node payout x(1 + 10% per re-sleeve done) |
| 3 | Residual Proficiency | Clearance Escalation (unchanged: unlocks the sixth action built on another branch; its place may move) | Hive Interface | *Server Lease: the same as Offshore Account for nodes |
| 4 | Residual Firewall | Overdrive Cap | Neural Mirror | *Laundered Savings: Offshore Account and Server Lease use k = 20% |
| 5 | *Firmware Recall: re-installs last life's regular firmware in the same order as points arrive | *Sleeve Attunement: sleeve levels give +7.5% speed each instead of +5% | Perfect Copies | *Venture Capital: credit-paid purchases' growth per copy is raised to the power 0.9 (x100,000 becomes about x31,600) |
| 6 | *Residual Augments: half the augment schematics applied last life stay applied | *Peak Conditioning: each action's sleeve level also counts as action levels for speed | *Shared Memory: sleeve XP x(1 + ln(1 + synthetic sleeves) / 10) | *Compound Pension: Pension Fund compounds, x1.1 per re-sleeve |
| 7 | *Imprint: choose one regular firmware skill that starts every life installed for free | *Sleeve Doubling: sleeve levels cost x1.9 more each instead of x2 | *Assembly Line: produces synthetic sleeves on its own (placeholder one per 10 minutes, faster with each re-sleeve; copies of the best recorded run; closed form from elapsed time) | **Old Money*** (capstone): what you owned last life costs price^0.9 this life (1e30 becomes 1e27), and Reflex Archive buys back every credit-paid purchase |
| 8 | **Engram*** (capstone): one free imprint per regular firmware tree | **Apex Sleeve*** (capstone): every action counts as having one Focus slot on top of the real ones | **Distributed Self*** (capstone): every action gets +1% action XP per synthetic sleeve | |

Joins (both parents needed, 1 point):
- Retention x Reach: **Scar Tissue**, applied augment schematics also boost that action's sleeve XP at half their action XP value (may be too strong; balance pass).
- Reach x Synthetics: **Neural Uplink**, synthetic sleeve income x(1 + total sleeve levels / 100): a better body makes better copies.
- Reach x Capital: **Black Market Clinic**, Faster conditioning copies survive a re-sleeve.
- Retention x Capital: **Private Tutor**, each life starts with +1 regular firmware point per 5 re-sleeves done.
- Synthetics x Capital: **Incorporation**, needs Neural Mirror (Synthetics 4) and Laundered Savings (Capital 4); roots the corporation branch.

Corporation branch: Incorporation, then Synthetic Workers, then Synthetic Procurement, then about three places kept for when the corporation is designed (candidate end: **Template Sleeve**, every synth copies your current sleeve, the vision's template idea).

Watch: Imprint, Engram and Private Tutor give free regular firmware (point calibration); Firmware Recall automates firmware only after at least five lives of manual choice; Apex Sleeve with Overdrive Cap is a lot of speed; a free "reset sleeve skills" button (vision) matters more now that order and joins are choices. The sixth action's tags (they mark upgrades, and its runs multiply tagged upgrades) are not mapped onto any tree yet.

Rejected this round: Echo (carrying 10% of action XP shortens runs far too fast and makes Imprint and Engram irrelevant); Assembly Line as +1 sleeve per 5 skills (outgrown once synths are bought); Offshore Account and Server Lease as a share of peak (mandatory first pick, trivialises the rebuild); Venture Capital, Old Money and any price cut as a plain percentage (no effect on huge prices); Blind Trust (half the Kompromat kept; too much at once); Ingrained Habits (settings are managed on purpose); Estate Planning (the last life is always the best); Practiced Transfer (scales the re-sleeve requirement, which must not scale).

## Later, separate tasks

Top-to-bottom tree layout with the inspector; Anonymity after the rebase; the corporation branch of Sleeve Firmware once the corporation is designed; mapping the sixth action's tags onto these trees; point-gain calibration.
