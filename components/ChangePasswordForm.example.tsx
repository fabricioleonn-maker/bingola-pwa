// Exemplo de componente de mudança de senha autenticada
// (Para usuários já logados - não precisa de email)

import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNotificationStore } from '../state/notificationStore';

export const ChangePasswordForm = () => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword.length < 6) {
            useNotificationStore.getState().show('Senha deve ter no mínimo 6 caracteres', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            useNotificationStore.getState().show('As senhas não coincidem', 'error');
            return;
        }

        setLoading(true);
        try {
            // MÉTODO 1: Verificar senha atual primeiro (mais seguro)
            const { data: { user } } = await supabase.auth.getUser();
            if (!user?.email) throw new Error('Usuário não encontrado');

            // Tentar fazer login com senha atual para validar
            const { error: loginError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: currentPassword
            });

            if (loginError) {
                useNotificationStore.getState().show('Senha atual incorreta', 'error');
                return;
            }

            // MÉTODO 2: Atualizar senha (usuário já autenticado)
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            useNotificationStore.getState().show('Senha alterada com sucesso!', 'success');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            useNotificationStore.getState().show(error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
                <label className="block text-xs font-bold text-white/40 mb-2">Senha Atual</label>
                <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
                    required
                />
            </div>

            <div>
                <label className="block text-xs font-bold text-white/40 mb-2">Nova Senha</label>
                <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
                    required
                />
            </div>

            <div>
                <label className="block text-xs font-bold text-white/40 mb-2">Confirmar Nova Senha</label>
                <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
                    required
                />
            </div>

            <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-black font-bold py-3 rounded-xl disabled:opacity-50"
            >
                {loading ? 'Alterando...' : 'Alterar Senha'}
            </button>
        </form>
    );
};
