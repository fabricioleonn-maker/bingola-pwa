import React from 'react';
import { useNotificationStore } from '../state/notificationStore';

export const NotificationToast: React.FC = () => {
    const notifications = useNotificationStore(s => s.notifications);

    if (notifications.length === 0) return null;

    return (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
            {notifications.map(n => (
                <div
                    key={n.id}
                    className={`
            pointer-events-auto
            p-4 rounded-2xl shadow-2xl border backdrop-blur-md animate-slide-in-top
            flex items-center gap-3
            ${n.type === 'success' ? 'bg-green-500/90 border-green-400/50 text-white' : ''}
            ${n.type === 'error' ? 'bg-red-500/90 border-red-400/50 text-white' : ''}
            ${n.type === 'info' ? 'bg-surface-dark/90 border-white/10 text-white' : ''}
          `}
                >
                    <span className="material-symbols-outlined text-xl bg-white/20 p-1.5 rounded-full">
                        {n.type === 'success' && 'check'}
                        {n.type === 'error' && 'error'}
                        {n.type === 'info' && 'info'}
                    </span>
                    <div>
                        <p className="font-bold text-sm leading-tight">{n.message}</p>
                    </div>
                </div>
            ))}
        </div>
    );
};
