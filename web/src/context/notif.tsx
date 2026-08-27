import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './auth';
import { api } from '../lib/api';

type NotifCtx = { unreadCount: number; markAllRead: () => void };

const NotifContext = createContext<NotifCtx>({ unreadCount: 0, markAllRead: () => {} });

export function NotifProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnread = useCallback(() => {
    if (!token) return;
    api.get('/notifications/unread-count')
      .then((d: any) => setUnreadCount(d.count ?? 0))
      .catch(() => {});
  }, [token]);

  const markAllRead = useCallback(() => {
    if (!token) return;
    api.post('/notifications/read-all', {})
      .then(() => setUnreadCount(0))
      .catch(() => refreshUnread());
  }, [token, refreshUnread]);

  useEffect(() => { refreshUnread(); }, [refreshUnread]);

  return (
    <NotifContext.Provider value={{ unreadCount, markAllRead }}>
      {children}
    </NotifContext.Provider>
  );
}

export const useNotif = () => useContext(NotifContext);
