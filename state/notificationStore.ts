import { create } from 'zustand';

type NotificationType = 'success' | 'error' | 'info';

interface Notification {
    id: string;
    message: string;
    type: NotificationType;
}

interface ModalOptions {
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
}

interface NotificationState {
    notifications: Notification[];
    modal: ModalOptions | null;
    show: (message: string, type?: NotificationType) => void;
    dismiss: (id: string) => void;
    confirm: (options: ModalOptions) => void;
    closeModal: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
    notifications: [],
    modal: null,
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
    },
    confirm: (options) => {
        set({ modal: options });
    },
    closeModal: () => {
        set({ modal: null });
    }
}));
