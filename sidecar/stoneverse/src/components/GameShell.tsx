import {
  Anvil,
  Backpack,
  Bell,
  ChevronLeft,
  CircleUserRound,
  FlaskConical,
  Gem,
  Home,
  Infinity as InfinityIcon,
  MapPinned,
  Menu,
  Microscope,
  Mountain,
  Settings,
  Shield,
  Sparkles,
  Swords,
  Ticket,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { UiPlayer, UiRoute } from './uiTypes';

interface GameShellProps {
  route: UiRoute;
  player: UiPlayer;
  children: ReactNode;
  title: string;
  subtitle?: string;
  onNavigate: (route: UiRoute) => void;
  onBack?: () => void;
  online: boolean;
  syncCount: number;
  notificationCount: number;
  onOpenNotifications: () => void;
}

const navigation: Array<{ route: UiRoute; label: string; icon: typeof Home; group?: string }> = [
  { route: 'home', label: 'ホーム', icon: Home },
  { route: 'mine', label: '採掘', icon: Mountain, group: 'COLLECT' },
  { route: 'collection', label: '図鑑', icon: Backpack },
  { route: 'gacha', label: '召喚', icon: Sparkles },
  { route: 'fusion', label: '配合ラボ', icon: FlaskConical, group: 'BUILD' },
  { route: 'facilities', label: '育成・研究', icon: Microscope },
  { route: 'expedition', label: '遠征', icon: MapPinned, group: 'ADVENTURE' },
  { route: 'battle', label: '戦闘', icon: Swords },
  { route: 'endless', label: '無限鉱坑', icon: InfinityIcon },
  { route: 'ranking', label: 'ランキング', icon: Trophy, group: 'ONLINE' },
  { route: 'profile', label: 'プロフィール', icon: CircleUserRound },
];

const mobileRoutes = navigation.filter((item) => ['home', 'mine', 'collection', 'expedition', 'endless'].includes(item.route));

export function GameShell({ route, player, children, title, subtitle, onNavigate, onBack, online, syncCount, notificationCount, onOpenNotifications }: GameShellProps) {
  const [mobileMenu, setMobileMenu] = useState(false);

  const navigate = (next: UiRoute) => {
    onNavigate(next);
    setMobileMenu(false);
  };

  return (
    <div className="game-shell">
      <aside className={`side-nav ${mobileMenu ? 'is-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><Gem strokeWidth={1.4} /></div>
          <div><strong>STONEVERSE</strong><span>RESONANCE PROTOCOL</span></div>
          <button type="button" className="icon-button side-nav__close" onClick={() => setMobileMenu(false)} aria-label="メニューを閉じる"><X /></button>
        </div>
        <nav aria-label="メインメニュー">
          {navigation.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={item.route}>
                {item.group ? <span className="nav-group">{item.group}</span> : null}
                <button
                  type="button"
                  className={`nav-item ${route === item.route ? 'is-active' : ''}`}
                  onClick={() => navigate(item.route)}
                  style={{ '--nav-index': index } as React.CSSProperties}
                >
                  <Icon size={19} strokeWidth={1.6} />
                  <span>{item.label}</span>
                  {item.route === 'gacha' && player.tickets > 0 ? <b className="nav-item__badge">{player.tickets}</b> : null}
                </button>
              </div>
            );
          })}
        </nav>
        <div className="side-nav__player">
          <button type="button" className="player-chip" onClick={() => navigate('profile')}>
            <span className="player-chip__avatar"><CircleUserRound /></span>
            <span><b>{player.username}</b><small>ACCOUNT LV.{player.accountLevel}</small></span>
            <Zap size={15} />
          </button>
          <button type="button" className="icon-button" onClick={() => navigate('settings')} aria-label="設定"><Settings size={19} /></button>
        </div>
      </aside>

      {mobileMenu ? <button className="side-nav-scrim" type="button" aria-label="メニューを閉じる" onClick={() => setMobileMenu(false)} /> : null}

      <div className="game-shell__main">
        <header className="topbar">
          <div className="topbar__heading">
            <button className="icon-button topbar__menu" type="button" onClick={() => setMobileMenu(true)} aria-label="メニュー"><Menu /></button>
            {onBack ? <button className="icon-button" type="button" onClick={onBack} aria-label="戻る"><ChevronLeft /></button> : null}
            <div><span className="eyebrow">STONEVERSE / {route.toUpperCase()}</span><h1>{title}</h1>{subtitle ? <p>{subtitle}</p> : null}</div>
          </div>
          <div className="resource-row" aria-label="所持資源">
            <span className="resource-pill"><Anvil size={15} /><small>MINING</small><b>{player.currency.toLocaleString()}</b></span>
            <span className="resource-pill"><Ticket size={15} /><small>TICKET</small><b>{player.tickets}</b></span>
            <span className="resource-pill resource-pill--research"><Shield size={15} /><small>RESEARCH</small><b>{player.research.toLocaleString()}</b></span>
          </div>
          <button className="notification-trigger" type="button" onClick={onOpenNotifications} aria-label={`通知センターを開く${notificationCount > 0 ? `、未読${notificationCount}件` : ''}`}>
            <Bell size={18} />
            {notificationCount > 0 ? <b>{notificationCount > 99 ? '99+' : notificationCount}</b> : null}
          </button>
          <button className="sync-status" type="button" title={online ? 'オンライン同期済み' : `${syncCount}件をオフライン保存中`}>
            <i className={online ? 'is-online' : ''} />
            <span>{online ? 'ONLINE' : `QUEUE ${syncCount}`}</span>
          </button>
        </header>
        <main className="screen-stage" key={route}>{children}</main>
      </div>

      <nav className="mobile-nav" aria-label="モバイルメニュー">
        {mobileRoutes.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.route} type="button" className={route === item.route ? 'is-active' : ''} onClick={() => navigate(item.route)}>
              <Icon size={20} strokeWidth={1.7} /><span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
