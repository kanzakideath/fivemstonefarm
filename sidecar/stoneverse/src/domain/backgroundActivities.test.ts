import { describe, expect, it } from 'vitest';
import { claimResearch, RESEARCH_PROJECTS, startResearch } from './backgroundActivities';
import { EXPEDITION_REGIONS } from './expedition';
import { SeededRng } from './rng';
import { cloneGameState, createInitialGameState } from './state';
import type { Clock, ResearchProjectId } from './types';

const HOUR = 60 * 60 * 1_000;

class MutableClock implements Clock {
  constructor(public milliseconds = Date.parse('2026-09-10T00:00:00.000Z')) {}
  now(): Date { return new Date(this.milliseconds); }
}

describe('research facility progression', () => {
  it('requires the three projects in order even if a lab level was externally raised', () => {
    const clock = new MutableClock();
    const state = createInitialGameState({ seed: 'research-order', clock });
    state.inventory.currencies.researchCores = 100;
    state.facilities.researchLab = 100;

    expect(() => startResearch(state, 'GENETIC_ARCHIVE', new SeededRng('skip-genetics'), clock))
      .toThrow(/Geology Survey must be completed first/);
    expect(() => startResearch(state, 'EXPEDITION_LOGISTICS', new SeededRng('skip-logistics'), clock))
      .toThrow(/Genetic Archive must be completed first/);
  });

  it('permanently advances every facility and reaches all seven regions and four expedition slots', () => {
    const clock = new MutableClock();
    let state = createInitialGameState({ seed: 'research-progression', clock });
    state.inventory.currencies.researchCores = RESEARCH_PROJECTS.reduce((sum, project) => sum + project.coreCost, 0);
    expect(state.facilities).toEqual({ fusionLab: 1, researchLab: 1, expeditionGuild: 1 });

    const complete = (projectId: ResearchProjectId, elapsedMs: number) => {
      const slot = startResearch(state, projectId, new SeededRng(`research:${projectId}`), clock);
      expect(() => claimResearch(state, slot.researchId, clock.now())).toThrow(/not complete/);
      clock.milliseconds += elapsedMs;
      const reward = claimResearch(state, slot.researchId, clock.now());
      expect(reward.projectId).toBe(projectId);

      const facilitiesAfterClaim = { ...state.facilities };
      const pointsAfterClaim = state.accountProgress.researchPoints;
      const itemsAfterClaim = { ...state.inventory.items };
      expect(() => claimResearch(state, slot.researchId, clock.now())).toThrow(/already claimed/);
      expect(state.facilities).toEqual(facilitiesAfterClaim);
      expect(state.accountProgress.researchPoints).toBe(pointsAfterClaim);
      expect(state.inventory.items).toEqual(itemsAfterClaim);
    };

    complete('GEOLOGY_SURVEY', HOUR);
    expect(state.facilities).toEqual({ fusionLab: 2, researchLab: 3, expeditionGuild: 3 });

    complete('GENETIC_ARCHIVE', 12 * HOUR);
    expect(state.facilities).toEqual({ fusionLab: 4, researchLab: 5, expeditionGuild: 5 });

    complete('EXPEDITION_LOGISTICS', 24 * HOUR);
    expect(state.facilities).toEqual({ fusionLab: 6, researchLab: 7, expeditionGuild: 7 });
    expect(state.inventory.currencies.researchCores).toBe(0);
    expect(state.research.completedProjectIds).toEqual([
      'GEOLOGY_SURVEY',
      'GENETIC_ARCHIVE',
      'EXPEDITION_LOGISTICS',
    ]);
    expect(EXPEDITION_REGIONS.every((region) => region.requiredGuildLevel <= state.facilities.expeditionGuild)).toBe(true);
    expect(Math.min(4, 1 + Math.floor((state.facilities.expeditionGuild - 1) / 2))).toBe(4);

    state = cloneGameState(state);
    expect(state.facilities).toEqual({ fusionLab: 6, researchLab: 7, expeditionGuild: 7 });
    expect(state.research.completedProjectIds).toHaveLength(3);
  });

  it('never lowers facility levels when an older research reward is claimed', () => {
    const clock = new MutableClock();
    const state = createInitialGameState({ seed: 'research-monotonic', clock });
    state.inventory.currencies.researchCores = 1;
    const slot = startResearch(state, 'GEOLOGY_SURVEY', new SeededRng('research-monotonic'), clock);
    state.facilities = { fusionLab: 10, researchLab: 10, expeditionGuild: 10 };
    clock.milliseconds += HOUR;

    claimResearch(state, slot.researchId, clock.now());

    expect(state.facilities).toEqual({ fusionLab: 10, researchLab: 10, expeditionGuild: 10 });
  });
});
