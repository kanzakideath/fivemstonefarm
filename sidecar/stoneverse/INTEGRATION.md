# STONEVERSE Integration Guide

This guide defines a future FiveM Farm host boundary for the standalone STONEVERSE sidecar. This phase does not modify Main App or Farm source.

## Non-negotiable boundary

Farm reports committed facts. STONEVERSE owns game outcomes.

```text
Farm success fact
  -> public StoneverseApi command
  -> STONEVERSE validation/domain transaction
  -> schema-v5 save + optional online queue
```

Farm must not calculate or write STONEVERSE XP, affinity, rarity, Species, IVs, mutation, Stone instances, Expedition/Endless outcomes, Equipment, Research, achievements, or rankings. STONEVERSE must not import Farm stores, routes, components, storage, account controllers, or FiveM globals.

Allowed edges are:

- the public API and typed events exported from `src/api`;
- explicit Storage, Account, Online, Navigation, and Clock/Time adapters;
- a separately built route or lazy mount;
- narrow, versioned, serializable payloads.

Never deep-import `src/domain`, `src/store`, screens, or internal Zustand actions from Farm. If the host needs a missing operation, add and contract-test it on `StoneverseApi` first.

## Deployment and runtime ownership

Keep `sidecar/stoneverse` independently buildable. The recommended first deployment is a lazy-loaded separate route/build so game JavaScript, media, schema, and release cadence do not enter Farm's initial path.

Create one runtime per signed-in STONEVERSE account:

1. Resolve an opaque account id and account-scoped storage namespace.
2. Create one store with injected storage, RNG, clock/time, and online dependencies.
3. Create one `StoneverseApi` and event bus.
4. Load/migrate before accepting Farm facts.
5. Start one `BackgroundRuntimeCoordinator`.
6. Subscribe host navigation/events once and mount the UI.
7. On logout/account switch: end session, save/flush by policy, stop coordinator, unsubscribe, dispose audio, unmount, and discard the runtime.

Do not create a scheduler/API per route. Route changes must not pause Expedition, Training, Research, or Auto Endless and must not duplicate listeners/timers.

## Background coordinator

`BackgroundScheduler` is persisted game state. `BackgroundRuntimeCoordinator` is the browser lifecycle adapter. The mounted sidecar currently wires one coordinator to store background processing, next-due projection, focus/visibility, and state-changing commands.

When a browser timer or manual wake fires while the document is hidden, the app selects offline accounting. This preserves that interval in the undismissed Welcome Back accumulator; only a visible due/manual wake is processed as silent active play.

A future host should either let the sidecar composition own that lifecycle or add a public coordinator adapter. It must not deep-import `src/domain/idle.ts` merely to obtain a due timestamp.

The coordinator schedules only the next due time, coalesces concurrent wakes, uses bounded timeout hops/backoff, and stops deterministically. UI countdowns are presentation only. Reward-bearing `setInterval` loops inside screens are forbidden.

A host-provided server clock may implement the injected clock/time contract. The current local trusted-time checkpoint rejects rollback reward and caps oversized forward movement once; it is not server authority.

## Farm mining input

The narrow host input is `onStoneMined(payload)`:

```ts
interface MiningPayload {
  eventId: string;        // stable across retry; unique within the account
  sessionId?: string;     // returned by onFarmSessionStarted()
  timestamp?: string;     // ISO source time
  areaId?: string;        // mapped public content id
  veinId?: string;        // mapped public content id
  amount?: number;        // bounded committed fact
  quality?: number;       // bounded committed fact
  metadata?: Record<string, unknown>;
}
```

Call it only after Farm commits its own successful mining action. Reuse the same `eventId` after timeout/retry; never create another id for the same success. Metadata must not contain tokens, secrets, full Farm state, or unbounded user input.

```ts
const sessionId = api.onFarmSessionStarted();

farmEvents.on('mining:committed', (fact) => {
  api.onStoneMined({
    eventId: fact.id,
    sessionId,
    timestamp: fact.committedAt,
    areaId: mapFarmArea(fact.location),
    veinId: mapFarmVein(fact.nodeType),
    amount: fact.amount,
    quality: fact.quality,
    metadata: { sourceSequence: fact.sequence },
  });
});
```

The result may contain STONEVERSE progression, credits, and unappraised discoveries. Farm may display a summary but must not write the returned values back into game state.

Session hooks:

- `onFarmSessionStarted()` returns the STONEVERSE session id and is idempotent while active.
- `onFarmSessionEnded()` is safe in disconnect/finally cleanup and ignores repeated cleanup.
- Mining after an explicitly ended managed session is rejected before rewards.
- `syncFarmStatistics()` derives a STONEVERSE-owned snapshot and flushes its due online queue; it does not accept Farm totals.

Client event ids/session checks do not replace authenticated server revocation or durable dedupe.

## Public API surface

The current API returns cloned values at the boundary; callers cannot mutate live Zustand state through a result/event payload.

### Core and Dungeon

```ts
api.getStoneverseState();
api.getFarmStatistics();
api.exportStoneverseSave();
api.importStoneverseSave(serialized);

api.appraiseStone(discoveryId);
api.pullGacha(bannerId, count);
api.fuseStones(parentIds, options);
api.trainStone(stoneId, xp);
api.evolveStone(stoneId, evolutionId, areaId);
api.awakenStone(stoneId);

api.startDungeonBattle(dungeonId, stageId);
api.issueBattleCommand(skillId, targetIds);
api.advanceBattle();
api.setBattleAuto(auto);
api.setBattleSpeed(speed);       // 1 | 2 | 4
api.runBattle();
api.abandonBattle();
```

New Dungeon battles persist one authoritative Advanced state. Each Manual round supplies one player-selected command and lets the remaining actors use the shared AI path; Auto continues that same encounter. The legacy fields returned in `BattleState` are a synchronized settlement/API projection.

### Background and Expedition

```ts
api.processBackground(mode);

api.startExpedition(options);
api.stopExpedition(expeditionId);
api.claimExpedition(expeditionId);
api.claimStoredExpeditionDiscovery(discoveryId);

api.startTraining(stoneId);
api.claimTraining();
api.stopTraining();

api.startAffinityGarden(stoneId);
api.claimAffinityGarden();
api.stopAffinityGarden();

api.startResearch(projectId);
api.claimResearch(researchId);
```

`stopExpedition` disables repeat without deleting the current cycle or stored reward. Multi-cycle catch-up emits aggregate transitions rather than one host event per cycle.

### Endless and Equipment

```ts
api.startEndlessMine(partyStoneIds);
api.advanceEndlessMine(maxFloors);
api.setEndlessManual(manual);
api.setEndlessStrategy(strategy);
api.setEndlessSpeed(speed);
api.issueEndlessCommand(skillId, targetIds);
api.pauseEndlessMine();
api.resumeEndlessMine();
api.claimEndlessMine();

api.updateEndlessLootFilter(filter);
api.salvageEndlessEquipment(equipmentId);
api.equipEndlessEquipment(equipmentId, stoneId);
api.unequipEndlessEquipment(equipmentId, stoneId);
api.setEndlessEquipmentLocked(equipmentId, locked);
```

The same shared inventory owns Expedition-materialized and Endless-dropped Equipment. Equip/unequip preserves `sourceStat`, `setId`, Lock, and item identity. Replaced gear returns to inventory; full-capacity unequip is rejected instead of losing the item.

### Navigation, profile, ranking

```ts
api.openStoneverse();
api.openProfile();
api.openGacha();
api.openCollection();
api.openRanking();
api.openStoneDetail(stoneId);

api.getPublicProfile(accountId);
api.getLeaderboard(category, limit);
```

Mock Online includes weekly Endless highest-floor, fastest-clear, and fewest-damage categories. Fastest/fewest use ascending, lower-is-better ordering, and an own row is omitted while its value is unmeasured. These are development contracts, not production authority.

Every mutating command uses the store persistence/transaction boundary. A save exception prevents the state/reward commit.

## Typed local events

The event bus clones payloads, isolates listener exceptions, and returns an unsubscribe function. Relevant event groups are:

- Stone/core: `stone:mined`, `stone:discovered`, `stone:levelUp`, `stone:affinityUp`, `stone:awakened`, `stone:evolved`, `stone:fused`, `gacha:result`, `achievement:unlocked`.
- Dungeon: `battle:started`, `battle:turn`, `battle:finished`.
- Expedition: `expedition:started`, `expedition:completed`, `expedition:claimed`, `expedition:rareDiscovered`, `expedition:discoveryClaimed`.
- Facilities: `training:*`, `affinityGarden:*`, `research:*`, `mastery:gained`, `idle:processed`.
- Endless lifecycle: `endless:started`, `endless:advanced`, `endless:manualChanged`, `endless:strategyChanged`, `endless:speedChanged`, `endless:command`, `endless:paused`, `endless:resumed`, `endless:finished`, `endless:claimed`.
- Endless Equipment: `endless:lootFilterChanged`, `endless:equipmentSalvaged`, `endless:equipmentEquipped`, `endless:equipmentUnequipped`, `endless:equipmentLockChanged`.
- Host/UI: `route:changed`, `save:imported`, `sync:completed`, `session:started`, `session:ended`, `error`.

There is currently no dedicated `expedition:stopped` event; the stop command result/state is authoritative. Host listeners must treat all events as read-only notifications, never as a second reward authority.

```ts
const unsubscribe = api.on('expedition:completed', ({ cyclesCompleted }) => {
  hostNotifications.enqueue(`Expedition x${cyclesCompleted} completed`);
});

// account/runtime teardown
unsubscribe();
```

## Routing and launch

Add one host entry such as “STONEVERSE” and lazy-load the sidecar route.

For a separate route/build, pass only short-lived authenticated bootstrap data. If iframe/postMessage is used, validate exact origin, nonce, protocol version, schema, and account scope; never place bearer tokens/full state in query strings or unrestricted messages.

For an in-process React mount, use a namespaced root, prevent reset/theme leakage, inject adapters before runtime construction, stop scheduler/audio/subscriptions on unmount, and never reuse Farm's Zustand store. Host Navigation owns back/close history behavior.

## Storage and migration

Current keys:

- `stoneverse.save.v5`
- `stoneverse.save.v5.pending`
- `stoneverse.save.v5.backup`

Legacy v4 current/pending/backup and v3 are recovery candidates only. Keep every key separate from Farm storage.

The envelope contains format, schema version, timestamp, checksum, and state. Load/import verifies checksum, migrates, and strictly validates before replacement. Checksummed v4 migrates; raw v4/current-v5 is rejected. Pending promotion is read back before current replacement, and previous current is kept as backup.

If every candidate is corrupt, recovery write-blocking protects the evidence from automatic or manual overwrite. If browser storage is unavailable, the sidecar remains playable for the session but presents persistence as unavailable and disables manual save/load.

A host release must test representative v1/v3/v4/current/corrupt/future/interrupted-write saves. Never let an older client overwrite a future schema.

## Account and online authority

`accountId` must be opaque and stable. Use account-specific Storage/Online adapters and recreate the runtime on account switch. Never expose access tokens through state, URLs, assets, logs, or metadata.

`MockOnlineAdapter` supplies deterministic demo profiles, sorting, and queue responses only. A production backend must authenticate account/session, enforce object ownership, issue trusted time, calculate canonical rewards/rankings, durably dedupe facts/claims, reject modified/reordered/stale/future/impossible inputs, handle partial retries, and implement privacy/export/deletion/moderation policy.

Client `processedFarmEventIds`, claim ledgers, and checksums are local safety controls, not server proof.

## Assets, audio, and performance

Request media through logical ids in `src/assets`. Replace placeholders by keeping the id, adding approved sources/derivatives, and setting `placeholder: false`; do not add speculative URLs.

The Expedition/Endless concept PNG still needs responsive AVIF/WebP, crop/focal metadata, base-path/CDN policy, provenance, and decode/memory validation. Current audio uses synth/fallback definitions; recorded sources require license, codec, loudness, and loop validation. Keep one interaction-gated audio manager per runtime. Adaptive BGM is not implemented.

Lazy-load noncritical code/media, wake background work only at due/lifecycle events, keep countdown rendering separate from rewards, and measure Farm + STONEVERSE together on target devices. The verified build currently emits a 684.71 kB raw / 208.53 kB gzip JavaScript bundle and retains Vite's large-chunk warning, so production integration should add route/vendor splitting before treating bundle performance as closed.

## Integration acceptance checklist

- [ ] Standalone launch works with no Farm present.
- [ ] One committed Farm success produces one mining transaction; retrying its id adds no reward.
- [ ] Managed input is rejected after session end.
- [ ] v4 migrates to v5 without loss; corrupt/future state does not overwrite recoverable data.
- [ ] Expedition/Research/Endless continue across route changes and restart.
- [ ] Same-time reload and claim retry cannot duplicate rewards.
- [ ] Dungeon Manual -> Auto continues one persisted Advanced encounter.
- [ ] All seven Endless encounter classes and checkpoint resume work through public/UI paths.
- [ ] Equipment beyond the first page remains reachable; target equip, unequip, Lock, and salvage are lossless.
- [ ] One account owns one runtime/coordinator/subscription/audio set.
- [ ] Account A cannot read, claim, or upload Account B state.
- [ ] Desktop/mobile, blocked storage, focus/visibility, keyboard, screen-reader, reduced-motion, and mute journeys pass.
- [ ] Import scan finds no Farm/FiveM dependency below the public edge.
- [ ] Production server rejects replay, stale/future, impossible, and cross-account requests.

Final local automated verification: PASS — TypeScript, 44-file/258-test Vitest, simulations, build, zero-vulnerability audit, boundary scan, and 34-check/13-screenshot E2E all passed. Production authority/media gates remain separately required.

## Rollout and rollback

Ship behind a feature flag, beginning with internal accounts. Record sidecar/schema/adapter versions, migration result, save failure, scheduler catch-up time, queue age, rejection reason, route error, and consented performance telemetry.

Rollback must preserve v5 data. Disable the launch flag and deploy a forward-compatible fix; do not downgrade by writing an older schema over newer state.
