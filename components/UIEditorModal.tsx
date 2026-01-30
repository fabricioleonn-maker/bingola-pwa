
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNotificationStore } from '../state/notificationStore';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    elementId: string;
    currentLabel: string;
    onSave: (newLabel: string) => void;
}

export const UIEditorModal: React.FC<Props> = ({ isOpen, onClose, elementId, currentLabel, onSave }) => {
    const [label, setLabel] = useState(currentLabel);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setLabel(currentLabel);
    }, [currentLabel]);

    const handleSave = async () => {
        if (!label.trim()) return;
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('ui_labels')
                .upsert({ element_id: elementId, label: label.trim() });

            if (error) throw error;

            onSave(label.trim());
            useNotificationStore.getState().show('UI atualizada com sucesso!', 'success');
            onClose();
        } catch (err: any) {
            useNotificationStore.getState().show('Erro ao salvar UI: ' + err.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <div className="w-full max-w-sm bg-stone-900 rounded-[2.5rem] p-8 border border-white/10 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                    <span className="material-symbols-outlined text-primary">edit_square</span>
                    <h3 className="font-black italic uppercase text-sm">Editar Elemento</h3>
                </div>

                <div className="space-y-4">
                    <div>
                        <p className="text-[10px] font-black text-white/20 uppercase mb-2">ID do Elemento</p>
                        <code className="text-[10px] bg-white/5 p-2 rounded-lg block text-white/40">{elementId}</code>
                    </div>

                    <div>
                        <p className="text-[10px] font-black text-white/20 uppercase mb-2">Novo Rótulo / Texto</p>
                        <input
                            type="text"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-primary/50 outline-none"
                            placeholder="Digite o novo texto..."
                        />
                    </div>
                </div>

                <div className="flex gap-3 mt-8">
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 rounded-2xl bg-white/5 text-[10px] font-black uppercase text-white/40"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !label.trim()}
                        className="flex-1 py-4 rounded-2xl bg-primary text-black text-[10px] font-black uppercase shadow-lg shadow-primary/20 disabled:opacity-50"
                    >
                        {isSaving ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>
        </div>
    );
};
