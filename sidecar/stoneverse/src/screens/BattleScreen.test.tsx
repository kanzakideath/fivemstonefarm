import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { UiBattleState, UiStone } from '../components/uiTypes';
import { BattleScreen } from './BattleScreen';

const stone = (id: string, name: string): UiStone => ({
  id, speciesId: 'species_pebblit', name, nickname: '', rarity: 'NORMAL', origin: 'EVENT', element: 'EARTH', level: 10,
  xp: 0, xpNext: 100, combatPower: 1000, potential: 50, personality: '戦術型', affinity: 0, awakening: 0, evolution: 0, generation: 0,
  favorite: false, locked: false, serial: id, obtainedAt: '', discoverer: '', originalOwner: '', stats: { hp: 500, power: 100, defense: 100, speed: 100, resonance: 100 },
  ivs: { hp: 0, power: 0, defense: 0, speed: 0, resonance: 0 }, traits: [], skills: ['Stone Strike'], equipment: [], parentIds: [], battleWins: 0, battleCount: 0,
});

const stones = [stone('a', 'Alpha'), stone('b', 'Beta'), stone('c', 'Gamma')];
const fighter = (owned: UiStone, unitId: string) => ({ unitId, stone: owned, hp: 500, maxHp: 500, ultimate: 20, status: [] });
const battle: UiBattleState = {
  phase: 'running', turn: 2,
  allies: stones.map((owned) => fighter(owned, `player_${owned.id}`)),
  enemies: [fighter(stone('enemy', 'Pebblit'), 'enemy_1')],
  log: [], manualMode: true, speed: 1, commandActorId: 'player_a',
  commands: [{ id: 'skill_stone_strike', name: 'Stone Strike', cooldown: 0, ultimateCost: 0, disabled: false, target: 'ENEMY' }],
  turnOrder: [
    { id: 'player_a', name: 'Alpha', side: 'PLAYER', speed: 142, active: true },
    { id: 'enemy_1', name: 'Pebblit', side: 'ENEMY', speed: 88, active: false },
  ],
};

describe('BattleScreen advanced controls', () => {
  it('shows authoritative speed order and exposes manual, auto and presentation speed controls', () => {
    const callbacks = {
      onSetParty: vi.fn(), onStartBattle: vi.fn(), onAdvanceBattle: vi.fn(), onCommand: vi.fn(),
      onAutoChange: vi.fn(), onSpeedChange: vi.fn(), onAbandon: vi.fn(),
    };
    render(<BattleScreen stones={stones} partyIds={stones.map((entry) => entry.id)} battle={battle} reducedMotion {...callbacks} />);

    expect(screen.getByLabelText('速度順')).toHaveTextContent('SPD 142');
    fireEvent.click(screen.getByLabelText('攻撃対象').querySelector('button')!);
    fireEvent.click(screen.getByRole('button', { name: /Stone Strike/ }));
    expect(callbacks.onCommand).toHaveBeenCalledWith('skill_stone_strike', ['enemy_1']);
    fireEvent.click(screen.getByRole('switch'));
    expect(callbacks.onAutoChange).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: '4x' }));
    expect(callbacks.onSpeedChange).toHaveBeenCalledWith(4);
  });
});
