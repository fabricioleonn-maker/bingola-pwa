
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNotificationStore } from '../state/notificationStore';

interface ResetPasswordProps {
    onComplete: () => void;
}

export const ResetPasswordScreen: React.FC<ResetPasswordProps> = ({ onComplete }) => {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    useEffect(() => {
        // Verificar se há um token de recuperação na URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const type = hashParams.get('type');

        if (type !== 'recovery' || !accessToken) {
            setErrorMsg('Link de recuperação inválido ou expirado.');
        }
    }, []);

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);

        if (!newPassword || !confirmPassword) {
            setErrorMsg('Por favor, preencha todos os campos.');
            return;
        }

        if (newPassword.length < 6) {
            setErrorMsg('A senha deve ter no mínimo 6 caracteres.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setErrorMsg('As senhas não coincidem.');
            return;
        }

        setLoading(true);
        try {
            // Garante que o Supabase processou o token antes de tentar o update
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setErrorMsg('Sessão de segurança não encontrada. Use o link do e-mail novamente.');
                return;
            }

            const { error } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (error) {
                const lowMsg = error.message.toLowerCase();
                let msg = error.message;

                if (lowMsg.includes('different from') || lowMsg.includes('same as old')) {
                    msg = 'A nova senha deve ser diferente da senha atual.';
                } else if (lowMsg.includes('rate limit') || lowMsg.includes('seconds')) {
                    const secondsMatch = error.message.match(/\d+/);
                    const seconds = secondsMatch ? secondsMatch[0] : 'alguns';
                    msg = `Aguarde ${seconds} segundos antes de tentar novamente.`;
                } else if (lowMsg.includes('invalid') || lowMsg.includes('expired')) {
                    msg = 'O link de recuperação expirou ou é inválido.';
                } else if (lowMsg.includes('session missing') || lowMsg.includes('not logged in')) {
                    msg = 'Sessão expirada. Por favor, use o link do e-mail novamente.';
                }

                setErrorMsg(msg);
                return;
            }

            useNotificationStore.getState().show('Senha alterada com sucesso!', 'success');

            // Aguardar 1 segundo antes de redirecionar
            setTimeout(() => {
                onComplete();
            }, 1000);
        } catch (e: any) {
            setErrorMsg('Erro inesperado. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-background-dark">
            <div className="w-full max-w-md space-y-8">
                <div className="flex flex-col items-center gap-4">
                    <img src="/pwa-512x512.png" alt="Bingola" className="w-32 h-32 object-contain rounded-3xl" />
                    <div className="text-center space-y-1">
                        <h2 className="text-2xl font-black italic uppercase tracking-wider text-white">
                            Redefinir Senha
                        </h2>
                        <p className="text-sm text-white/40 font-medium">
                            Digite sua nova senha
                        </p>
                    </div>
                </div>

                <form onSubmit={handleResetPassword} className="space-y-4">
                    <div className="relative">
                        <label className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2 block pl-1">
                            Nova Senha
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Mínimo 6 caracteres"
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 pr-12 text-white placeholder:text-white/20 focus:outline-none focus:border-primary transition-colors"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                            >
                                <span className="material-symbols-outlined">{showPassword ? 'visibility_off' : 'visibility'}</span>
                            </button>
                        </div>
                    </div>

                    <div className="relative">
                        <label className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2 block pl-1">
                            Confirmar Senha
                        </label>
                        <div className="relative">
                            <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Digite novamente"
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 pr-12 text-white placeholder:text-white/20 focus:outline-none focus:border-primary transition-colors"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                            >
                                <span className="material-symbols-outlined">{showConfirmPassword ? 'visibility_off' : 'visibility'}</span>
                            </button>
                        </div>
                    </div>

                    {errorMsg && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center">
                            <p className="text-red-500 text-xs font-bold">{errorMsg}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary text-black font-black uppercase tracking-widest py-4 rounded-2xl shadow-lg shadow-primary/20 hover:shadow-primary/40 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <div className="flex items-center justify-center gap-2">
                                <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                <span>Alterando...</span>
                            </div>
                        ) : (
                            'Alterar Senha'
                        )}
                    </button>
                </form>

                <div className="text-center space-y-2">
                    <button
                        onClick={onComplete}
                        className="text-sm text-white/40 hover:text-white/60 font-medium transition-colors"
                    >
                        Voltar para login
                    </button>
                </div>
            </div>
        </div>
    );
};
