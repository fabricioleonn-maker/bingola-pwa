import { create } from 'zustand';

type NotificationType = 'success' | 'error' | 'info';

interface Notification {
    id: string;
    message: string;
    type: NotificationType;
}

interface NotificationState {
    notifications: Notification[];
    show: (message: string, type?: NotificationType) => void;
    dismiss: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
    notifications: [],
    show: (message, type = 'success') => {
        const id = Date.now().toString();
        set((state) => ({
            notifications: [...state.notifications, { id, message, type }]
        }));

        // Auto-dismiss after 3 seconds
        setTimeout(() => {
            set((state) => ({
                notifications: state.notifications.filter(n => n.id !== id)
            }));
        }, 3000);
    },
    dismiss: (id) => {
        set((state) => ({
            notifications: state.notifications.filter(n => n.id !== id)
        }));
    }
}));
