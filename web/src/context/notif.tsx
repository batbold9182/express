import React, { createContext, useCallback, useContext } from 'react';
import { useAuth } from './auth';
import { useMarkAllRead, useUnreadCount } from '../queries/notifications';

type NotifCtx = { unreadCount: number; markAllRead: () => void };

const NotifContext = createContext<NotifCtx>({ unreadCount: 0, markAllRead: () => {} });

export function NotifProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const { data: unreadCount = 0 } = useUnreadCount(!!token);   // polls every minute while the tab is visible
  const { mutate: markRead } = useMarkAllRead();

  const markAllRead = useCallback(() => { if (token) markRead(); }, [token, markRead]);

  return (
    <NotifContext.Provider value={{ unreadCount, markAllRead }}>
      {children}
    </NotifContext.Provider>
  );
}

export const useNotif = () => useContext(NotifContext);
