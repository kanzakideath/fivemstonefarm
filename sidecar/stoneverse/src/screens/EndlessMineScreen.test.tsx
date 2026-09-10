import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { EndlessMineViewModel } from '../components/adventureTypes';
import { EndlessMineScreen } from './EndlessMineScreen';

const model: EndlessMineViewModel = {
  status: 'RUNNING', canResumeFromCheckpoint: false, floor: 37, bestFloor: 82, floorProgress: 64, winStreak: 11, partyPower: 8420, enemyPower: 9130,
  encounter: { type: 'TREASURE', label: 'Sealed Geode', description: '罠を見切れば高密度の報酬を得る。' }, resonanceIntegrity: 73,
  modifiers: [
    { id: 'hazard', name: '崩壊圧', description: 'ターン終了時に防御が低下。', tone: 'HAZARD' },
    { id: 'boon', name: '結晶導線', description: '共鳴スキルの効果上昇。', tone: 'BOON' },
  ],
  turnOrder: [
    { id: 'ally', name: 'Quartzling', side: 'ALLY', initiative: 81, element: 'CRYSTAL', active: true },
    { id: 'enemy', name: 'Deep Sentinel', side: 'ENEMY', initiative: 67, element: 'DARK' },
  ],
  strategy: 'BALANCED', speed: 2, manualMode: false,
  commands: [
    { id: 'burst', label: '共鳴破砕', description: '単体に共鳴攻撃。', keyHint: '1' },
    { id: 'guard', label: '全域防壁', description: '味方全体を保護。', keyHint: 'space', costLabel: 'ULT 100' },
  ],
  equipment: [
    { id: 'gear-01', name: '共鳴レンズ', slot: 'CORE', rarity: 'SSR', level: 7, score: 912, effect: 'RES +12%' },
    ...Array.from({ length: 12 }, (_, index) => ({ id: `gear-${index + 2}`, name: index === 11 ? '13番目の装備' : `保管装備 ${index + 2}`, slot: 'RUNE', rarity: 'NORMAL' as const, level: 1, effect: 'DEF +1' })),
    { id: 'gear-equipped', name: '装着中の遺物', slot: 'RELIC', rarity: 'UR', level: 18, effect: 'CRIT +9%', equippedBy: 'Quartzling', equippedById: 'stone-a', locked: true },
  ],
  equipmentInventoryCount: 13,
  equipmentCapacity: 300,
  salvageMaterials: 42,
  equipmentTargets: [{ id: 'stone-a', name: 'Quartzling', level: 18 }, { id: 'stone-b', name: 'Prismara', level: 25 }],
  autoSalvage: { enabled: true, threshold: 'RARE', protectFavorites: true, queuedCount: 4 },
  battleLog: ['Quartzlingが共鳴波を展開。', 'Deep Sentinelに1,240ダメージ。'],
  rewardPreview: [{ id: 'dust', label: 'Upgrade Dust', amount: 72, kind: 'MATERIAL' }],
};

describe('EndlessMineScreen', () => {
  it('exposes AI, speed, equipment, salvage, and keyboard manual controls through callbacks', () => {
    const callbacks = {
      onStart: vi.fn(), onPauseToggle: vi.fn(), onRetreat: vi.fn(), onStrategyChange: vi.fn(), onSpeedChange: vi.fn(),
      onManualModeChange: vi.fn(), onCommand: vi.fn(), onEquipmentAction: vi.fn(), onEquipEquipment: vi.fn(),
      onUnequipEquipment: vi.fn(), onSalvageEquipment: vi.fn(), onEquipmentLockChange: vi.fn(), onAutoSalvageChange: vi.fn(),
    };
    const { rerender } = render(<EndlessMineScreen model={model} reducedMotion {...callbacks} />);

    expect(screen.getAllByText('037')[0]).toBeVisible();
    expect(screen.getByText('崩壊圧')).toBeVisible();
    expect(screen.getByText('Sealed Geode')).toBeVisible();
    expect(screen.getByText(/INTEGRITY 73%/)).toBeVisible();
    expect(screen.getAllByText('Quartzling')[0]).toBeVisible();
    expect(screen.getByRole('button', { name: /共鳴破砕/ })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /AGGRESSIVE/ }));
    expect(callbacks.onStrategyChange).toHaveBeenCalledWith('AGGRESSIVE');
    fireEvent.click(screen.getByRole('button', { name: '×4' }));
    expect(callbacks.onSpeedChange).toHaveBeenCalledWith(4);
    fireEvent.click(screen.getByRole('switch', { name: /AI CONTROL/ }));
    expect(callbacks.onManualModeChange).toHaveBeenCalledWith(true);
    expect(screen.getByText('13番目の装備')).toBeVisible();
    fireEvent.change(screen.getByLabelText('装備先Stone'), { target: { value: 'stone-b' } });
    fireEvent.click(screen.getAllByRole('button', { name: '装着' })[0]!);
    expect(callbacks.onEquipEquipment).toHaveBeenCalledWith('gear-01', 'stone-b');
    fireEvent.click(screen.getByRole('button', { name: '共鳴レンズをロック' }));
    expect(callbacks.onEquipmentLockChange).toHaveBeenCalledWith('gear-01', true);
    fireEvent.click(screen.getByRole('button', { name: '共鳴レンズを分解' }));
    expect(callbacks.onSalvageEquipment).toHaveBeenCalledWith('gear-01');
    fireEvent.click(screen.getByRole('button', { name: '解除' }));
    expect(callbacks.onUnequipEquipment).toHaveBeenCalledWith('gear-equipped', 'stone-a');
    fireEvent.click(screen.getByRole('switch', { name: '自動分解' }));
    expect(callbacks.onAutoSalvageChange).toHaveBeenCalledWith({ ...model.autoSalvage, enabled: false });

    rerender(<EndlessMineScreen model={{ ...model, manualMode: true }} reducedMotion {...callbacks} />);
    expect(screen.getByRole('button', { name: /共鳴破砕/ })).toBeEnabled();
    fireEvent.keyDown(window, { key: '1', code: 'Digit1' });
    expect(callbacks.onCommand).toHaveBeenCalledWith('burst');
    fireEvent.click(screen.getByRole('button', { name: '一時停止' }));
    expect(callbacks.onPauseToggle).toHaveBeenCalledOnce();
  });

  it('offers an unclaimed defeated run a real checkpoint choice', () => {
    const callbacks = {
      onStart: vi.fn(), onPauseToggle: vi.fn(), onRetreat: vi.fn(), onStrategyChange: vi.fn(), onSpeedChange: vi.fn(),
      onManualModeChange: vi.fn(), onCommand: vi.fn(), onEquipmentAction: vi.fn(), onAutoSalvageChange: vi.fn(),
    };
    render(<EndlessMineScreen model={{ ...model, status: 'ENDED', canResumeFromCheckpoint: true }} reducedMotion {...callbacks} />);

    fireEvent.click(screen.getByRole('button', { name: /Checkpointから再開/ }));
    expect(callbacks.onPauseToggle).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: /報酬を確定して終了/ }));
    expect(callbacks.onRetreat).toHaveBeenCalledOnce();
    expect(callbacks.onStart).not.toHaveBeenCalled();
  });
});
