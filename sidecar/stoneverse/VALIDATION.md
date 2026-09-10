# STONEVERSE Validation Record

Validation date: 2026-09-10

## Current verdict

Final combined verification: **PASS** for local automated verification. Production authority, anti-cheat, final-media, real-device accessibility, and target-hardware performance gates are excluded.

This file separates automated implementation evidence from production-readiness claims. Unit/integration tests can prove deterministic invariants and connected commands; they do not prove fun balance, hostile-client security, real-device accessibility/performance, or final art/audio quality.

## Reproducible commands

Run from `sidecar/stoneverse`:

```powershell
npm run typecheck
npm test
npm run test:simulation
npm run test:advanced-simulation
npm run test:idle-simulation
npm run build
npm audit
```

Production-preview browser run:

```powershell
npm run preview -- --host 127.0.0.1 --port 4173
$env:STONEVERSE_URL = 'http://127.0.0.1:4173/'
npm run test:e2e -- test-results
```

## Final evidence table

| Check | Result | Observed evidence |
|---|---|---|
| TypeScript | PASS | `tsc --noEmit` completed without errors |
| Full Vitest | PASS | 44 files / 258 tests / 10.14s |
| Legacy simulation | PASS | 1 file / 3 tests / 2.89s: 1,000,000 gacha, 200,000 mutation/IV, 100 battles |
| Advanced battle + Endless generation | PASS | 2 files / 15 tests / 8.55s; detailed 10,240-battle metrics below |
| Idle/offline integration | PASS | 5 files / 72 tests / 1.94s |
| TypeScript + Vite production build | PASS | 1,740 modules / 4.27s; HTML 0.64/0.43 kB, CSS 181.83/36.01 kB, JS 684.71/208.53 kB raw/gzip |
| Dependency audit | PASS | 0 vulnerabilities |
| Sidecar boundary scan | PASS | no FiveM/Farm imports or absolute FiveM paths in runtime `src` |
| Production-preview E2E | PASS | 34 checks / 0 errors / 13 screenshots |

Keep failed evidence in the table and rerun the same command after a fix.

## Automated evidence inventory

Status here means test code exists; the combined result is the table above.

| Area | Principal evidence | Behaviors represented |
|---|---|---|
| Trusted time | `src/domain/timeProvider.test.ts` | rollback=0, monotonic high-water, one-time 30d cap, restart replay resistance |
| Scheduler | `backgroundScheduler.test.ts`, `BackgroundRuntimeCoordinator.test.ts`, `App.test.tsx` | deterministic due order, recurrence batch/skip, persisted restore, failure retry/backoff, wake coalescing, hidden-wake offline policy |
| Scheduler persistence | `persistence.test.ts` | discriminated job payloads, duplicate ids, run/assignment reference integrity |
| Expedition | `src/domain/expedition.test.ts` | configs, concurrent slots, full snapshot, real-build sensitivity, repeat/stop, deterministic replay, 2,880-cycle catch-up, report/storage, no-loss Rare, idempotent/atomic claim |
| Idle/facilities | `idle.test.ts`, `backgroundActivities.test.ts`, `backgroundStore.test.ts` | 15m-30d, period deltas, successive hidden-window report accumulation, rollback, training/affinity/research lifecycle, quota rollback |
| Save/recovery | `src/store/persistence.test.ts`, `safeBrowserStorage.test.ts` | schema-v5 checksum, v4 migration, strict state bounds, pending/backup recovery, corrupt write-block, denied storage |
| Gacha/Fusion capacity | `gacha.test.ts`, `fusion.test.ts` | preflight capacity, no partial currency/parent loss, consumed-parent Equipment return |
| Mastery | `mastery.test.ts`, `endlessMastery.integration.test.ts` | post-cap conversion, direct/Training/Expedition integration, bounded passive |
| Combat adapter | `stoneCombatAdapter.test.ts` | actual stats/IV/affinity/mutation/skills/traits/lineage/Equipment source stats and set bonus |
| Advanced resolver | `advanced/combat.test.ts` | order, accuracy, crit, heal/shield, buff/debuff, DoT/control, Break/counter, synergy, Ultimate/AoE, Boss phases/summons/enrage, finite clamps |
| AI | `advanced/ai.test.ts` | five public strategies, heal/AoE/Ultimate/Boss/Break, status coverage, element/resistance/phase context, priority reasons |
| Normal Dungeon integration | `battle.test.ts`, `dungeonAdvanced.integration.test.ts` | persisted authoritative Advanced state, Manual -> Auto continuity, actual 3-Stone build, idempotent settlement/reload |
| Battle UI | `BattleScreen.test.tsx`, `useStoneverseGame.test.tsx` | turn order, target command, Manual/Auto, 1x/2x/4x, public API bridge |
| Endless generation | `advanced/endlessMine.test.ts` | all seven encounters, deterministic risk/recovery, weekly rule, Boss cadence, integrity, checkpoints, Active/Auto/Offline efficiency, 1-1,000 finite generation |
| Endless campaign | `endlessCampaign.test.ts`, `endlessMastery.integration.test.ts` | combat/non-combat resolution, manual/auto/offline cursor, max floor, checkpoint resume, weekly reset, strict persistence, claim/salvage bridge |
| Equipment | `advanced/equipment.test.ts`, store/API/screen integration tests | four slots, six rarities, affix/set, filter/capacity, lock, target equip, replacement/unequip, salvage, full-list UI |
| Public API/events | `stoneverseApi.test.ts`, `online.test.ts` | clone isolation, lifecycle transitions, equip/unequip/lock events, Mock ranking and lower-is-better categories |
| Presentation | Expedition/Endless/Ranking screen tests, `adventureOverlays.test.tsx`, `App.test.tsx` | form callbacks, staged reveal, full Equipment operations, checkpoint choice, dialog/notification interaction, route composition |
| Assets/audio/runtime | `AssetRegistry.test.ts`, `AudioManager.test.ts`, motion/effect/log/performance tests | registry validity/fallbacks, audio limits/crossfade, reduced motion, bounded caches/logs |

## Expedition and offline integrity

Automated fixtures establish:

- all seven regions and 15m/30m/1h/3h/4h/6h/12h/24h durations;
- Party snapshot immutability across later Stone changes;
- reward sensitivity to stats, skills/effects, traits, equipment/source stats/sets, mutation, affinity, element, and lineage;
- independent run slots and repeat stop without deleting the current cycle/storage;
- a 30-day 15-minute repeat processes at most 2,880 cycles and keeps 64 detailed events;
- 100 replays of one claim add no reward;
- a persistence exception rolls credits, items, Stone growth, and claim cursor back together;
- full Stone capacity sends Rare Discovery to persistent temporary storage;
- full 100-entry Rare storage rejects the entire claim before partial rewards and repeat processing stops before pending overflow;
- later storage claim creates an Expedition-origin Stone and updates collection/statistics/achievements;
- logical Expedition Equipment becomes deterministic affixed/scored Advanced instances through the shared filter without duplicate generic tokens;
- Training/Affinity/Research/Endless use saved elapsed/cursors and do not double award at the same trusted timestamp;
- hidden-tab due/manual wakes use offline accounting, and successive due windows retain their Expedition deltas in one undismissed Welcome Back summary;
- a 365-day wall jump receives one 30-day window, and 100 same-time restarts add nothing.

Limits not solved by these fixtures:

- client editing of save/checkpoint data;
- two-tab/device concurrent revision and claim arbitration;
- browser/OS power loss inside storage internals;
- server reward/dedupe ledger;
- host-facing per-item Expedition materialization receipt;
- a product decision for a completely full Rare mailbox.

## Save migration and validation

The current writer uses schema 5 under v5 current/pending/backup keys. Tests cover mandatory envelope/checksum, checksummed v4 migration, older prototype migration, interrupted promotion recovery, and current-state strict validation.

Strict validation covers Stone capacity/references, parties, current Advanced battle, Expedition snapshot/report/storage, facilities, trusted-time checkpoint, relational scheduler jobs, Research ledger, all Endless encounter/run/battle/equipment invariants, Mastery, bounds, and finite numeric values. Legacy/current raw objects that bypass a mandatory checksum boundary are rejected.

Still required before production:

- exhaustive real v4 save corpus and a large-save migration benchmark;
- two-tab conflict and account A/B isolation;
- real-browser fault injection for every write/remove point;
- signed server checkpoints and future-schema rollout/rollback drills.

## Advanced Battle evidence

`advancedSimulation.test.ts` ran 10,240 seeded battles. Every result terminated inside its turn budget, preserved finite bounded HP/shield/action values, and accounted for every requested outcome. Observed outcomes were PLAYER 4,815 / ENEMY 5,081 / DRAW 344, a 47.021% player win rate and 10.64 average turns. Totals were 15,770,238 damage, 3,974,395 healing, and 427,178 actions. The simulation wall time was 7.37s; Vitest reported the test body at 6.226s and the two-file advanced command at 8.55s.

Normal Dungeon tests additionally prove that:

- a newly created Dungeon stores `AdvancedBattleState` as authoritative state;
- the real Party's learned skills, traits, elements, equipment affixes/sets, mutation, affinity, and lineage reach the resolver;
- a Manual command followed by Auto progresses the same battle id/state;
- speed order and command choices are projected to the Battle screen;
- settlement/history/reward/statistics are idempotent after completion and reload.

The stress run is stability evidence, not a final balance report. A release still needs reviewed results by role, element, strategy, Party composition, floor/Boss, gear/set, mutation/lineage, turn percentiles, status uptime, and player progression cohort.

## Endless evidence

The generated Floor 1-1,000 fixture requires exactly 1,000 definitions, 100 every-tenth-floor Bosses, presence of all seven encounter classes, finite increasing difficulty/reward/enemy stats, stable weekly rules, and deterministic outcomes.

Campaign tests cover:

- BATTLE/ELITE/BOSS through Advanced combat;
- MINING/TREASURE/RANDOM_EVENT risk checks and REST recovery;
- resonance-integrity wear/recovery and power effect;
- first-clear reward/equipment protection across checkpoint replay;
- Active 1.00, Auto 0.94, Offline 0.78 and a 720h cap;
- failed-floor accounting, pause/resume, defeat checkpoint choice, weekly boundary reset, and clean Floor 1,000,000 completion;
- corrupted active-floor/battle/run/equipment combinations being rejected.

Mock Online exposes Endless highest floor, fastest clear, and fewest damage; fastest/fewest sort lower-is-better. An own fastest/fewest row is omitted while that metric is unmeasured. It is not a server-authoritative weekly competition. Realistic build clear rates, time-to-wall, weekly variance, and metric integrity remain balance/backend work.

## Equipment evidence

Tests cover deterministic generation, affix count/tier/score, four slots, six rarities, all four 2/4 sets, filter behavior, protected set/Lock behavior, manual salvage, capacity replacement, safe-integer materials, and validation rejection.

Store/API/UI integration covers:

- selecting a specific target Stone;
- moving an item from shared inventory to a Stone slot;
- returning the replaced item without auto salvage;
- rejecting full-capacity unequip before removal;
- Lock/Unlock for inventory and equipped items;
- locked salvage rejection;
- every inventory item being present in the scrollable UI, including entries beyond the former 12-item slice;
- preserving exact `sourceStat`, `setId`, affix, level, rarity, identity, and Lock through conversion;
- parent-consumption Fusion returning gear without loss;
- Endless salvage materials transferring to main Upgrade Dust on claim.

Unimplemented: enhancement/reroll/preset/compare UX and a host-facing per-item reward receipt.

## Legacy regression simulations

`core.simulation.test.ts` retains:

| Simulation | Sample | Invariant |
|---|---:|---|
| Base-rate gacha | 1,000,000 draws | configured distribution tolerance |
| Mutation/IV | 200,000 | mutation range and IV mean |
| Battle | 100 complete battles | bounded resolution |

The battle entry now exercises the current battle facade; old projection/fallback compatibility remains a regression concern but is not the primary new-Dungeon engine.

## Production-preview E2E

The current smoke script observes page errors, console errors, failed requests, HTTP failures, and horizontal overflow. It covers:

- boot/Home and route navigation;
- Mine/appraise, collection/detail/train, gacha reveal, Fusion reveal;
- normal Dungeon Manual target command -> Auto -> result;
- Facilities training start/stop;
- Expedition Party/region/duration/strategy/repeat configuration;
- Endless AI/speed and Equipment target/presentation checks;
- Notification Center interaction;
- desktop screenshots and 390px mobile Home/Expedition/Endless/Facilities/Notification overflow checks;
- blocked `localStorage` startup and visible disabled save/load warning.

Final production-preview result: PASS — 34 checks, 0 errors, and 13 screenshots. The report observed zero page/console/network failures in its covered journeys.

The current smoke does not time-travel a browser through a completed Expedition report/claim, a long Endless checkpoint/loot/claim journey, every individual Equipment mutation, or v4 browser migration. Those flows have domain/store/component tests but remain browser E2E gaps. Focus trapping, screen-reader output, contrast/flash, real touch devices, and long-session animation/audio are also not certified.

## Performance and bounds

Structural limits include:

- Expedition: 30 days, 2,880 cycles/advance, 128-cycle chunks, 64 event details;
- Rare storage: 100 persistent entries and a bounded pending run buffer;
- Scheduler/runtime: callback/occurrence budgets, arithmetic backlog skip, one next-due timer;
- Endless: 720 offline hours, 10,000 due floors per aggregate pass, Floor 1,000,000 maximum;
- Equipment: capacity maximum 10,000 and safe-integer salvage materials;
- bounded histories, reports, notifications, online batches, caches, logs, and numeric saturation.

| Metric | Status |
|---|---|
| Advanced 10,240 simulation wall time | 7.37s wall; 6.226s Vitest test body; advanced command 8.55s |
| 30-day Expedition reconciliation | 2,880 cycles / 73.083ms |
| 30-day Endless, overpowered Party | 8,640 floors / 193.237ms |
| Endless, normal Party | 56 cleared / 57 attempted / 1.242ms |
| Idle/offline integration command | 5 files / 72 tests / 1.94s |
| Production bundle raw/gzip | HTML 0.64/0.43 kB; CSS 181.83/36.01 kB; JS 684.71/208.53 kB |
| 30-day reconciliation peak memory | NOT MEASURED |
| Large-save v4 -> v5 migration wall time | NOT MEASURED |
| Desktop/mobile p95 frame and long tasks | NOT MEASURED |
| Long-session heap/audio/GPU growth | NOT MEASURED |
| Farm + STONEVERSE shared-main-thread impact | NOT MEASURED |

A timeout-limited test is not a target-device benchmark. The build passes, but Vite reports its large-chunk warning for the 684.71 kB JavaScript output; route/vendor splitting remains open. Production measurements must record hardware, OS/browser, save size, command/journey, elapsed time, memory, and artifact hash.

## Asset and audio validation

Source audit at this revision:

- visual manifest: 44 entries, two file-backed, 42 production-required placeholders;
- generated Expedition/Endless concept master: 1672x941 PNG;
- audio manifest: 41 cues and 12 BGM definitions, each with a source or synthesis/fallback definition.

Registry tests check unique ids, safe fallbacks, and valid crossfade configuration. They do not certify media rights, final mix, responsive crops, compression/decode memory, codec behavior, loop clicks, speakers/headphones, adaptive BGM, cinematic VFX, or zero-placeholder production readiness.

## Boundary and security

Suggested final scan:

```powershell
rg -n -i "fivem|farm/(store|router|components)|window\.(GetParentResourceName|invokeNative)" src
```

Every match was reviewed; `onFarmSession*` names are legitimate public boundary names. Final result: PASS — no FiveM/Farm import or absolute FiveM path exists in runtime `src`.

No production authentication, authorization, anti-replay, server-time, ranking authority, or penetration test exists. Local `TimeProvider`, checksum, and claim ledgers are not anti-cheat or server proof. The Welcome/Idle Report claim surface summarizes per-system banks/storage and is not one cross-system atomic claim transaction. Before online claims, implement durable server claim/fact dedupe, object-level authorization, canonical progression/rank calculation, impossible/stale/future/reordered input rejection, queue-poisoning controls, privacy/moderation/export/deletion, CSP/origin/nonce validation where relevant, and incident/rollback runbooks.

Skill Dojo, procedural bounties, Ghost Battle, adaptive BGM, final media, raids, guilds, trade, production PvP, and payments remain unimplemented and therefore have no validation claim.

## Final evidence template

```text
Artifact/hash:
OS / Node / npm:
Chrome:
typecheck:                    result / duration
npm test:                    files / tests / duration / result
legacy simulation:           samples / metrics / duration / result
advanced simulation:         10,240 outcomes / turn & usage metrics / duration / result
idle simulation:             files / tests / duration / result
endless 1-1,000:             encounter counts / bosses / finite / duration / result
build:                        modules / artifacts / raw+gzip / result
npm audit:                   advisory counts / result
E2E:                         checks / errors / screenshots / result
boundary scan:               reviewed matches / violations / result
```
