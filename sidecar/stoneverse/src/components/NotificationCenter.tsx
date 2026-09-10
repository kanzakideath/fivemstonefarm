import { Bell, CheckCheck, ChevronRight, CircleAlert, Clock3, Gem, PackageCheck, Radar, Settings2, Shield, Sparkles, Swords, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { NotificationKind, NotificationView } from './adventureTypes';

export interface NotificationCenterProps {
  open: boolean;
  notifications: NotificationView[];
  onClose: () => void;
  onRead: (notificationId: string) => void;
  onReadAll: () => void;
  onAction?: (notificationId: string) => void;
  onOpenSettings?: () => void;
}

const notificationIcons: Record<NotificationKind, typeof Bell> = {
  EXPEDITION: Radar,
  DISCOVERY: Gem,
  BATTLE: Swords,
  SYSTEM: Shield,
  REWARD: PackageCheck,
};

export function NotificationCenter({ open, notifications, onClose, onRead, onReadAll, onAction, onOpenSettings }: NotificationCenterProps) {
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const unread = notifications.filter((notification) => !notification.read).length;
  const visible = useMemo(() => filter === 'UNREAD' ? notifications.filter((notification) => !notification.read) : notifications, [filter, notifications]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="notification-layer">
      <button type="button" className="notification-backdrop" aria-label="通知センターを閉じる" onClick={onClose} />
      <aside className="notification-center" role="dialog" aria-modal="true" aria-labelledby="notification-title">
        <header className="notification-center__header">
          <div><span className="eyebrow">SIGNAL ARCHIVE</span><h2 id="notification-title"><Bell /> 通知センター {unread > 0 ? <b>{unread}</b> : null}</h2></div>
          <button type="button" className="icon-button" aria-label="閉じる" onClick={onClose} autoFocus><X /></button>
        </header>

        <div className="notification-toolbar">
          <div><button type="button" aria-pressed={filter === 'ALL'} className={filter === 'ALL' ? 'is-active' : ''} onClick={() => setFilter('ALL')}>すべて</button><button type="button" aria-pressed={filter === 'UNREAD'} className={filter === 'UNREAD' ? 'is-active' : ''} onClick={() => setFilter('UNREAD')}>未読 <span>{unread}</span></button></div>
          <button type="button" disabled={unread === 0} onClick={onReadAll}><CheckCheck /> すべて既読</button>
        </div>

        <div className="notification-feed" aria-live="polite">
          {visible.length ? visible.map((notification) => {
            const Icon = notificationIcons[notification.kind];
            return (
              <article className={`${notification.read ? 'is-read' : 'is-unread'} notification-item--${notification.kind.toLowerCase()}`} key={notification.id}>
                <button type="button" className="notification-item__main" onClick={() => onRead(notification.id)} aria-label={`${notification.title}${notification.read ? '' : '、未読'}`}>
                  <span className="notification-item__icon"><Icon /></span>
                  <span className="notification-item__copy"><small>{notification.kind}</small><strong>{notification.title}</strong><p>{notification.detail}</p><time><Clock3 /> {notification.timeLabel}</time></span>
                  {!notification.read ? <i aria-label="未読" /> : null}
                </button>
                {notification.actionLabel && onAction ? <button type="button" className="notification-item__action" onClick={() => onAction(notification.id)}>{notification.actionLabel}<ChevronRight /></button> : null}
              </article>
            );
          }) : <div className="notification-empty">{filter === 'UNREAD' ? <CheckCheck /> : <Sparkles />}<strong>{filter === 'UNREAD' ? 'すべての信号を確認済みです' : '通知はまだありません'}</strong><p>新しい遠征報告や発見がここに記録されます。</p></div>}
        </div>

        <footer>{onOpenSettings ? <button type="button" onClick={onOpenSettings}><Settings2 /> 通知設定<ChevronRight /></button> : <span><CircleAlert /> IMPORTANT SIGNALS ARE STORED LOCALLY</span>}<kbd>ESC</kbd><small>閉じる</small></footer>
      </aside>
    </div>
  );
}
