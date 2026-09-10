import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ExpeditionViewModel } from '../components/adventureTypes';
import { ExpeditionScreen } from './ExpeditionScreen';

const planningModel: ExpeditionViewModel = {
  party: [
    { id: 'stone-a', name: 'Quartzling', rarity: 'RARE', element: 'CRYSTAL', level: 18, power: 1280, role: 'SUPPORT', condition: 'READY' },
    { id: 'stone-b', name: 'Emberite', rarity: 'SR', element: 'FIRE', level: 21, power: 1640, role: 'ATTACK', condition: 'READY' },
    { id: 'stone-c', name: 'Granitus', rarity: 'RARE', element: 'EARTH', level: 20, power: 1510, role: 'GUARD', condition: 'RESTING' },
  ],
  regions: [
    { id: 'region-crystal', name: '結晶洞・北環', sector: 'SECTOR 04', summary: '結晶反応が安定した調査区画。', element: 'CRYSTAL', difficulty: 2, recommendedPower: 2500, durations: [60, 180], rareSignalRate: 1.4, rewardHints: ['DUST', 'CRYSTAL'] },
    { id: 'region-ember', name: '熔炎回廊', sector: 'SECTOR 07', summary: '高熱の共鳴脈が続く危険区画。', element: 'FIRE', difficulty: 4, recommendedPower: 4800, durations: [120, 240], rareSignalRate: 3.2, rewardHints: ['EMBER', 'CORE'] },
  ],
  draft: { partyIds: ['stone-a', 'stone-b'], regionId: 'region-crystal', strategy: 'BALANCED', durationMinutes: 60, endless: false },
  runs: [],
  storedDiscoveries: [],
  availableSlots: 2,
  usedSlots: 0,
};

describe('ExpeditionScreen', () => {
  it('emits a complete controlled draft and starts only an available formation', () => {
    const onDraftChange = vi.fn();
    const onStart = vi.fn();
    render(<ExpeditionScreen model={planningModel} reducedMotion onDraftChange={onDraftChange} onStart={onStart} onClaim={vi.fn()} onStop={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /熔炎回廊/ }));
    expect(onDraftChange).toHaveBeenCalledWith({ ...planningModel.draft, regionId: 'region-ember', durationMinutes: 120 });

    fireEvent.click(screen.getByRole('button', { name: /慎重/ }));
    expect(onDraftChange).toHaveBeenCalledWith({ ...planningModel.draft, strategy: 'SAFE' });

    fireEvent.click(screen.getByRole('switch', { name: /ENDLESS ORDERS/ }));
    expect(onDraftChange).toHaveBeenCalledWith({ ...planningModel.draft, endless: true });

    expect(screen.getByRole('button', { name: /Granitus/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /遠征リンクを確立|遠征を開始/ }));
    expect(onStart).toHaveBeenCalledWith(planningModel.draft);
  });

  it('reveals a completed timeline on skip before allowing its claim', () => {
    const onClaim = vi.fn();
    const complete: ExpeditionViewModel = {
      ...planningModel,
      active: {
        id: 'expedition-01', status: 'COMPLETE', regionId: 'region-crystal', progress: 100,
        partyIds: ['stone-a', 'stone-b'], repeat: false, strategy: 'BALANCED', durationLabel: '3h', completedCycles: 1,
        remainingLabel: '00:00', elapsedLabel: '03:00:00', returnAtLabel: '21:40', canClaim: true,
        report: [
          { id: 'event-a', atLabel: '18:40', title: '出発', description: '北環へ移動。', type: 'DEPARTURE' },
          { id: 'event-b', atLabel: '20:12', title: '隠し仕切り', description: '微弱な波形を検出。', type: 'RARE_SIGNAL' },
        ],
        rewards: [{ id: 'dust', label: 'Upgrade Dust', amount: 140, kind: 'MATERIAL' }],
        summary: { battles: 1, wins: 1, miningYield: 140, rareDiscoveries: 1, equipmentDrops: 0, bestDropRarity: 'SSR' },
        rareSignal: { id: 'signal-01', hint: '既知のスペクトルに一致しません。' },
        canStop: false,
      },
    };
    complete.runs = [complete.active!];
    const { container } = render(<ExpeditionScreen model={complete} reducedMotion={false} onDraftChange={vi.fn()} onStart={vi.fn()} onClaim={onClaim} onStop={vi.fn()} />);
    const claim = screen.getByRole('button', { name: /帰還報酬を受け取る/ });
    expect(claim).toBeDisabled();
    expect(screen.queryByText(/Upgrade Dust ×140/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /演出をスキップ/ }));
    expect(container.querySelector('.expedition-unknown')).toHaveClass('is-visible');
    expect(screen.getByText(/Upgrade Dust ×140/)).toBeVisible();
    expect(claim).toBeEnabled();
    fireEvent.click(claim);
    expect(onClaim).toHaveBeenCalledWith('expedition-01');
  });

  it('keeps overflow discoveries reachable even when no expedition run remains', () => {
    const onInspectSignal = vi.fn();
    render(<ExpeditionScreen model={{ ...planningModel, storedDiscoveries: [{ id: 'stored-01', hint: 'UR resonance / abyss', sourceLabel: 'Abyssal Mine', discoveredAtLabel: '9月10日 08:30' }] }} reducedMotion onDraftChange={vi.fn()} onStart={vi.fn()} onClaim={vi.fn()} onStop={vi.fn()} onInspectSignal={onInspectSignal} />);

    expect(screen.getByRole('heading', { name: 'Temporary Discovery Storage' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /解析する/ }));
    expect(onInspectSignal).toHaveBeenCalledWith('stored-01');
  });

  it('selects every occupied slot while keeping another launch and per-run controls reachable', () => {
    const first: NonNullable<ExpeditionViewModel['active']> = {
      id: 'expedition-01', status: 'ACTIVE', regionId: 'region-crystal', partyIds: ['deployed-a'],
      repeat: false, strategy: 'BALANCED', durationLabel: '1h', completedCycles: 0, progress: 40, remainingLabel: '00:36:00', elapsedLabel: '00:24:00', returnAtLabel: '21:40',
      report: [], rewards: [], summary: { battles: 0, wins: 0, miningYield: 0, rareDiscoveries: 0, equipmentDrops: 0, bestDropRarity: null }, canClaim: false, canStop: false,
    };
    const second: NonNullable<ExpeditionViewModel['active']> = {
      id: 'expedition-02', status: 'ACTIVE', regionId: 'region-ember', partyIds: ['deployed-b'],
      repeat: true, strategy: 'MINING', durationLabel: '2h', completedCycles: 3, progress: 20, remainingLabel: '01:36:00', elapsedLabel: '06:24:00', returnAtLabel: '22:40',
      report: [], rewards: [{ id: 'credit-02', label: 'Mining Credits', amount: 900, kind: 'CURRENCY' }], summary: { battles: 3, wins: 2, miningYield: 800, rareDiscoveries: 0, equipmentDrops: 1, bestDropRarity: 'SR' }, canClaim: true, canStop: true,
    };
    const model: ExpeditionViewModel = { ...planningModel, runs: [first, second], active: first, usedSlots: 2, availableSlots: 3 };
    const onStart = vi.fn();
    const onClaim = vi.fn();
    const onStop = vi.fn();
    const { container } = render(<ExpeditionScreen model={model} reducedMotion onDraftChange={vi.fn()} onStart={onStart} onClaim={onClaim} onStop={onStop} />);
    const view = within(container);

    expect(container.querySelector('.expedition-run-manager__capacity span:last-child b')).toHaveTextContent('1');
    expect(view.getByRole('button', { name: /遠征を開始/ })).toBeEnabled();
    fireEvent.click(view.getByRole('button', { name: /SLOT 2.*熔炎回廊/ }));

    fireEvent.click(view.getByRole('button', { name: /現在のサイクル後に反復を停止/ }));
    expect(onStop).toHaveBeenCalledWith('expedition-02');
    fireEvent.click(view.getByRole('button', { name: /保存報酬を受け取る/ }));
    expect(onClaim).toHaveBeenCalledWith('expedition-02');

    fireEvent.click(view.getByRole('button', { name: /遠征を開始/ }));
    expect(onStart).toHaveBeenCalledWith(model.draft);
  });
});
