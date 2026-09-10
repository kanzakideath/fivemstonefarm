# STONEVERSE

STONEVERSE is a standalone browser RPG sidecar about discovering, raising, fusing, equipping, and battling persistent living Stones. It runs directly from `sidecar/stoneverse`; FiveM Farm is optional and may provide only validated mining facts through the public API.

> Status: substantial playable prototype and integration foundation, not a finished live service. The current build connects Expedition, trusted offline progression, facilities, Advanced Dungeon combat, seven-class Endless Mine encounters, Equipment loadouts, and schema-v5 persistence to the application UI. Production server authority, final media, content breadth, balance certification, and release accessibility/performance gates remain open.

## Core loop

```text
ACTIVE PLAY                         BACKGROUND / OFFLINE
Mine -> Appraise                    Expedition -> Report -> Claim
Dungeon -> Advanced Battle          Endless Mine -> Loot -> Build
Fuse -> Evolve                      Training / Affinity / Research
             \                     /
              persistent Stone growth
                         |
               rebuild Party and loadout
```

Each Stone is an individual instance with a serial, origin, Species, level/XP, IVs, personality, traits, skills, affinity, equipment, mutation, ownership, timestamps, lineage, and battle record. Manual combat keeps command control; Auto and Offline modes exchange some efficiency for convenience.

## Implemented feature set

- Seeded mining discoveries, appraisal, collection registration, Stone growth, evolution, awakening, profile, showcase, achievements, and rankings backed by Mock Online.
- Capacity-safe gacha, pity/guarantee/history, and atomic currency/storage validation.
- Fusion with catalysts, inheritance, mutation, genealogy, optional parent consumption, protected-parent validation, and lossless return of consumed parents' Equipment to shared storage.
- Normal three-Stone Dungeon battles backed by a persisted `AdvancedBattleState`. Manual commands and Auto continuation use the same Advanced resolver and retain speed order, skills, traits, equipment, lineage, rewards, and idempotent settlement.
- Advanced Combat features: accuracy/resistance, criticals, cooldowns, Ultimate, shields, buffs/debuffs, DoT, control, Break, counters, synergy, Boss phases/summons/enrage, and deterministic logs.
- Auto AI strategies: BALANCED, AGGRESSIVE, DEFENSIVE, BOSS_FOCUS, and RESOURCE_SAVE, with inspectable priority reasons.
- Real-time Expedition with seven regions, eight durations, strategy tradeoffs, up to four facility-scaled concurrent slots, immutable real-Stone build snapshots, repeat/stop, detailed reports, staged reveal, atomic claim, and no-loss Rare Discovery storage.
- Trusted-time reconciliation, rollback detection, one-time 30-day forward cap, persisted scheduler jobs, offline replay protection, and bounded reconciliation.
- Training Chamber, Affinity Garden, one-slot Research Chamber, and post-level-cap Stone/Species Mastery XP conversion.
- Endless Mine with deterministic BATTLE, MINING, TREASURE, ELITE, REST, RANDOM_EVENT, and BOSS encounters; biome/weekly/environment rules; resonance integrity; every-tenth-floor checkpoints/Bosses; Manual/Auto/Offline progression; defeat resume; and an idempotent claim ledger.
- Equipment with Core/Rune/Relic/Charm slots, six domain rarities, seeded affixes, four 2/4-piece sets, loot filters, locking-aware auto salvage, bounded capacity, and reversible Stone loadouts.
- The Equipment UI exposes the complete shared inventory and equipped items, explicit target-Stone selection, equip/unequip, Lock/Unlock, individual salvage, capacity, and salvage-material totals.
- Welcome Back summary, Idle Report, Notification Center, notification coalescing, Next Goals, and safe large-number formatting.
- Dedicated responsive routes for Expedition, Endless Mine, Facilities, Battle, and the retained vertical-slice screens.

## Important limits

- Trusted time and checksums are client-side integrity controls, not tamper-proof server authority.
- The 100-entry Rare Discovery mailbox prevents silent loss but can transactionally block an Expedition claim until Stone/mailbox capacity is freed.
- Expedition logical Equipment drops are materialized into deterministic Advanced Equipment and passed through the shared filter. `ExpeditionClaimResult` does not yet return a per-item accepted/replaced/salvaged receipt.
- Equipment source stats and set ids survive loadout conversion and affect Advanced Dungeon/Endless adapters. Some older collection/stat projections still do not present a complete derived build-score breakdown.
- The Idle Report aggregates subsystem state; it is not one cross-system atomic “claim all” ledger.
- Research currently contains three sequential projects and one active slot, not a final branching technology tree.
- Weekly Endless seed/highest-floor state and Mock Online categories for highest floor, fastest clear, and fewest damage are implemented; the latter two use lower-is-better ordering. An own fastest/fewest row is omitted while its metric is unmeasured. Production authority, trustworthy metric capture, and server rollover are not implemented.
- Skill Dojo, procedural bounties, Ghost Battle, raids, production PvP, trade, guilds, and payments are not implemented.
- Most final art, recorded SE, composed BGM, cinematic VFX, and adaptive BGM layers remain placeholders or synthesis fallbacks.
- Mock Online is development infrastructure, not authentication, anti-cheat, or ranking authority.

## Architecture

Dependencies point inward. Domain code does not import React, browser storage, FiveM, or host modules.

```text
FiveM/other host (optional)
        | narrow facts + adapters
Public StoneverseApi / typed events
        | commands
Zustand store --------> schema-v5 save + online queue
        |
Pure deterministic domains
        |
React projections/screens
        |
Assets / Audio / Runtime scheduler
```

| Layer | Owns | Must not own |
|---|---|---|
| `src/domain` | deterministic rules, transitions, simulations, invariants | React, localStorage, network, Farm imports |
| `src/data` | Species, skills, traits, recipes, dungeons, balance data | mutable player state |
| `src/store` | atomic orchestration and persistence boundary | host/Farm state |
| `src/api` | public commands, cloned results, typed event contract | direct Farm internals |
| `src/hooks` | React projections and composition glue | authoritative reward math |
| `src/components`, `src/screens` | presentation and interaction | trusted progression calculations |
| `src/systems` | scheduler runtime, assets, audio, motion, logs, performance helpers | feature-specific authority |

## Time, scheduler, and atomic progression

`TrustedTimeCheckpoint` stores monotonic game time and the greatest observed wall time. A rollback awards no elapsed time; an oversized forward movement is capped once at 30 days and cannot be amplified by repeated restarts at the same timestamp.

`BackgroundScheduler` is serialized state, not a browser timer. It orders jobs, batches recurrences, skips obsolete backlog arithmetically, and commits a cursor only after a handler succeeds. One account-scoped `BackgroundRuntimeCoordinator` wakes on startup, next due time, focus, visibility, or state-changing commands. Hidden-tab timer wakes use offline accounting so their deltas remain in the eventual Welcome Back report. Mounted screens never own reward-bearing intervals.

Reward/claim mutations execute through store transactions. A persistence exception rolls the game mutation back; claim ledgers and processed cursors prevent ordinary replay. Browser storage cannot provide distributed multi-tab or server-grade atomicity.

## Expedition build fidelity

Durations are 15m, 30m, 1h, 3h, 4h, 6h, 12h, and 24h. Regions are Starter Quarry, Crystal Cavern, Volcanic Rift, Ancient Stratum, Meteor Crater, Abyssal Mine, and Celestial Fault. Public strategies are BALANCED, COMBAT, MINING, DISCOVERY, SAFE, and HIGH_RISK; EXPERIENCE/MATERIALS remain compatibility aliases.

Departure freezes each selected Stone's stats, IVs, elements, role, skills, traits, equipment affixes/source stats/set ids, mutation, affinity, and lineage. Expedition aptitude calculations use those fields for combat, mining, exploration, research, element fit, and rewards rather than collapsing the Party to a single displayed power number. Repeat cycles accumulate in Expedition Storage; reports keep the latest 64 events while aggregate totals remain bounded.

## Advanced combat and Endless Mine

Normal Dungeon and combat-class Endless encounters both use the Advanced resolver. Dungeon `BattleState` persists the authoritative advanced state while maintaining legacy projection fields for settlement/API compatibility. Manual play injects one player-selected command into each resolved round while the remaining actors use the shared AI path; one-round Auto and run-to-completion continue that same encounter. The 1x/2x/4x setting is persisted presentation pacing.

Endless generation selects one of seven encounter classes deterministically. BATTLE/ELITE/BOSS create Advanced battles; MINING/TREASURE/REST/RANDOM_EVENT use deterministic power/risk/recovery resolution. Active non-combat floors resolve before the next manual combat encounter. Efficiency is Active 1.00, Auto 0.94, Offline 0.78. Offline uses a bounded aggregate strength model rather than replaying every animated turn.

## Save format

The current `STONEVERSE_SAVE` envelope is schema version 5 with a mandatory checksum. Current raw v5 and raw v4 objects are rejected. Checksummed v4 envelopes migrate to v5; v1-v3 raw compatibility remains for the earlier prototype boundary.

Default keys:

- `stoneverse.save.v5`
- `stoneverse.save.v5.pending`
- `stoneverse.save.v5.backup`

Legacy v4 current/pending/backup and the v3 key are read only as recovery/migration candidates. Promotion writes pending, verifies read-back, preserves a backup, promotes current, and clears pending. If every candidate is corrupt, automatic and manual writes remain blocked until recovery/import prevents accidental destruction of forensic data.

## Getting started

Use a current Node.js LTS supported by Vite 7 and npm.

```powershell
cd sidecar\stoneverse
npm install
npm run dev
```

| Command | Purpose |
|---|---|
| `npm run dev` | development server |
| `npm run typecheck` | strict app TypeScript check without emit |
| `npm run build` | TypeScript project build and production Vite bundle |
| `npm test` | full Vitest suite |
| `npm run test:simulation` | million-gacha/mutation/battle regression simulation |
| `npm run test:advanced-simulation` | 10,240 Advanced battles plus Endless generation suite |
| `npm run test:idle-simulation` | offline/Expedition/Endless/store integration suite |
| `npm run test:e2e` | Playwright-Core Chrome smoke against `STONEVERSE_URL` |
| `npm run preview` | serve `dist` locally |

Final local automated verification is PASS: 44 Vitest files / 258 tests, all simulation commands, production build, dependency audit, boundary scan, and 34-check / 13-screenshot production-preview E2E passed. This excludes production authority and final-media gates; exact measurements are in [VALIDATION.md](./VALIDATION.md).

## Assets and audio

`AssetRegistry` uses stable logical ids. The current visual manifest has 44 entries: two file-backed sources and 42 production-required placeholders. `background.expedition.frontier` points to the generated 1672x941 concept PNG; responsive production AVIF/WebP derivatives remain required.

`AudioManager` is interaction-gated and supports master/category volume, mute, cue cooldown/voice limits, crossfade, ducking, and synth fallback. The source manifest contains 41 cue definitions and 12 BGM definitions. These fallbacks are playable prototypes, not final recorded/composed media; adaptive battle music is not implemented.

## Main-app integration

Farm must report a committed mining fact through `StoneverseApi`; it must not calculate STONEVERSE XP, rarity, Stone instances, Expedition/Endless outcomes, Equipment, or offline rewards. Do not share Zustand stores or storage keys. See [INTEGRATION.md](./INTEGRATION.md).

## Release gates

Production readiness still requires authoritative account/time/reward/dedupe services, real-device performance and accessibility certification, reviewed balance/economy analysis, zero required media placeholders with provenance records, and privacy/security/operations runbooks. The production build passes, but its 684.71 kB raw (208.53 kB gzip) JavaScript bundle retains Vite's large-chunk warning. See [DEVELOPMENT_REPORT.md](./DEVELOPMENT_REPORT.md) for the implemented/open matrix and [VALIDATION.md](./VALIDATION.md) for reproducible checks.
