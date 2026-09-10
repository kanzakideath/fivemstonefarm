import { ArrowRight, Gem, Headphones, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

interface BootSequenceProps {
  newPlayer: boolean;
  reducedMotion: boolean;
  onComplete: () => void;
}

export function BootSequence({ newPlayer, reducedMotion, onComplete }: BootSequenceProps) {
  const [phase, setPhase] = useState<'signal' | 'title' | 'onboarding'>(reducedMotion ? (newPlayer ? 'onboarding' : 'title') : 'signal');
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (phase === 'signal') {
      const timer = window.setTimeout(() => setPhase('title'), 850);
      return () => window.clearTimeout(timer);
    }
    if (phase === 'title' && !newPlayer) {
      const timer = window.setTimeout(onComplete, reducedMotion ? 120 : 1050);
      return () => window.clearTimeout(timer);
    }
    if (phase === 'title' && newPlayer) {
      const timer = window.setTimeout(() => setPhase('onboarding'), reducedMotion ? 120 : 1050);
      return () => window.clearTimeout(timer);
    }
  }, [phase, newPlayer, reducedMotion, onComplete]);

  if (phase === 'signal') return <div className="boot boot--signal"><div className="boot-scan"><i /><i /><i /><Gem /></div><span>RESONANCE NETWORK</span><strong>接続信号を検証しています</strong><div className="boot-loader"><i /></div></div>;
  if (phase === 'title') return <div className="boot boot--title"><div className="boot-title-mark"><span /><Gem /></div><h1>STONEVERSE</h1><p>RESONANCE PROTOCOL</p><span className="boot-version">SIDECAR BUILD / SCHEMA VERIFIED</span></div>;

  const pages = [
    { icon: Gem, number: '01', title: '石は、ひとつの生命だ。', copy: '採掘で出会うすべての石は、固有の個体値・性格・血統を持ちます。育てた時間と選択が、その個体だけの物語になります。', tag: 'COLLECT / DISCOVER' },
    { icon: Sparkles, number: '02', title: '共鳴を重ね、未来を継ぐ。', copy: '育成した2体を配合し、能力・スキル・Traitを次世代へ。親個体は失われず、系譜は永く記録されます。', tag: 'TRAIN / FUSE / EVOLVE' },
    { icon: ShieldCheck, number: '03', title: 'あなたの編成を、世界へ。', copy: '3体の個体で共鳴隊を編成し、遠征やアリーナへ挑戦。発見と戦績はプロフィールとランキングへ刻まれます。', tag: 'BUILD / BATTLE / COMPETE' },
  ];
  const current = pages[page];
  const Icon = current.icon;
  return <div className="onboarding"><div className="onboarding__ambient"><i /><i /><i /></div><div className="onboarding__visual"><span className="onboarding__number">{current.number}</span><div className="onboarding__stone"><span /><Icon /></div></div><div className="onboarding__copy"><span className="eyebrow">ORIENTATION / {current.tag}</span><h2>{current.title}</h2><p>{current.copy}</p><div className="onboarding__audio"><Headphones /><span>サウンドをオンにすると、最高の体験を楽しめます</span></div><div className="onboarding__footer"><div className="onboarding__dots">{pages.map((_, index) => <i className={index === page ? 'is-active' : ''} key={index} />)}</div><button className="primary-action" type="button" onClick={() => page < pages.length - 1 ? setPage((value) => value + 1) : onComplete()}>{page < pages.length - 1 ? '次へ' : 'STONEVERSEを始める'}<ArrowRight /></button></div></div></div>;
}
