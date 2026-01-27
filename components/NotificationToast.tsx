import React from 'react';
import { useNotificationStore } from '../state/notificationStore';

export const NotificationToast: React.FC = () => {
    const notifications = useNotificationStore(s => s.notifications);
    const modal = useNotificationStore(s => s.modal);
    const closeModal = useNotificationStore(s => s.closeModal);

    return (
        <>
            {/* Global Notifications (Toasts) */}
            <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
                {notifications.map(n => (
                    <div
                        key={n.id}
                        onClick={() => useNotificationStore.getState().dismiss(n.id)}
                        className={`
                            pointer-events-auto cursor-pointer active:scale-95 transition-all
                            p-4 rounded-2xl shadow-2xl border backdrop-blur-md animate-in slide-in-from-top duration-300
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

            {/* Global Confirmation Modal */}
            {modal && (
                <div className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="bg-surface-dark w-full max-w-[360px] p-8 rounded-[3rem] border border-white/10 shadow-2xl relative overflow-hidden text-center">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl -mr-16 -mt-16"></div>

                        <div className="size-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                            <span className="material-symbols-outlined text-primary text-4xl">help</span>
                        </div>

                        <h3 className="text-2xl font-black italic mb-2">{modal.title}</h3>
                        <p className="text-white/40 text-xs font-medium leading-relaxed mb-8">{modal.message}</p>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => {
                                    modal.onConfirm();
                                    closeModal();
                                }}
                                className="w-full h-16 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-all italic uppercase tracking-widest text-sm"
                            >
                                Confirmar
                            </button>
                            <button
                                onClick={() => {
                                    if (modal.onCancel) modal.onCancel();
                                    closeModal();
                                }}
                                className="w-full h-16 bg-white/5 text-white/40 font-black rounded-2xl hover:bg-white/10 transition-colors uppercase tracking-widest text-xs"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
