
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAudioStore } from '../state/audioStore';
import { useNotificationStore } from '../state/notificationStore';
import { signInWithGoogle, signInWithApple } from '../lib/authService';
import { Capacitor } from '@capacitor/core';

interface Props {
  onBack: () => void;
  onComplete: () => void;
}

export const RegisterScreen: React.FC<Props> = ({ onBack, onComplete }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validações básicas
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    if (!termsAccepted) {
      setError('Você deve aceitar os Termos de Uso e Política de Privacidade para continuar.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem!');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const { data: existingUsers } = await supabase
        .from('profiles')
        .select('username')
        .ilike('username', name);

      if (existingUsers && existingUsers.length > 0) {
        setError('Este nome de usuário já está em uso.');
        setLoading(false);
        return;
      }

      const { data: existingEmails } = await supabase
        .from('profiles')
        .select('email')
        .ilike('email', email);

      if (existingEmails && existingEmails.length > 0) {
        setError('Este email já está cadastrado.');
        setLoading(false);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            username: name,
            display_name: name
          }
        }
      });

      if (authError) {
        if (
          authError.message.includes('registered') ||
          authError.message.includes('already') ||
          authError.message.includes('exists') ||
          authError.status === 422
        ) {
          setError('Este email já está cadastrado.');
        } else {
          setError(authError.message);
        }
        setLoading(false);
        return;
      }

      if (authData.user) {
        if (authData.user.identities && authData.user.identities.length === 0) {
          setError('Este e-mail já está cadastrado. Tente fazer login.');
          setLoading(false);
          return;
        }
      }

      const isConfirmationRequired = authData.session === null;
      if (isConfirmationRequired) {
        useNotificationStore.getState().show("Conta criada! Verifique sua caixa de entrada para confirmar seu e-mail.", 'info');
        onBack();
      } else {
        useAudioStore.getState().setGenre('00INTRO');
        useAudioStore.setState({ currentTrackIndex: 1, isPlaying: true });
        onComplete();
      }
    } catch (e: any) {
      setError(e.message || 'Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    if (!termsAccepted) {
      setError('Aceite os termos para continuar.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error } = provider === 'google' ? await signInWithGoogle() : await signInWithApple();
      if (error) {
        setError(error.message);
        useNotificationStore.getState().show(error.message, 'error');
      } else if (Capacitor.isNativePlatform()) {
        onComplete();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTimeout(() => setLoading(false), 2000);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background-dark text-white font-sans relative overflow-hidden flex flex-col pb-[env(safe-area-inset-bottom)]">
      {/* Background Decorativo */}
      <div className="absolute inset-0 opacity-20 pointer-events-none z-0">
        <div className="absolute top-[5%] left-[10%] w-[50vw] h-[50vw] bg-primary/20 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[10%] right-[10%] w-[60vw] h-[60vw] bg-secondary/15 rounded-full blur-[120px]"></div>
      </div>

      <header className="p-4 flex items-center justify-between sticky top-0 bg-black/80 backdrop-blur-md z-20">
        <button onClick={onBack} className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors">
          <span className="material-symbols-outlined text-white">arrow_back</span>
        </button>
        <h2 className="text-lg font-bold flex-1 text-center pr-12 text-white">Criar Conta</h2>
      </header>

      <main className="flex-1 flex flex-col px-6 relative z-10">
        <div className="text-center py-6 flex flex-col items-center">
          <div className="mb-4 animate-float-slow">
            <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white/10 shadow-xl">
              <img src="/pwa-512x512.png" alt="Bingola Logo" className="w-full h-full object-cover" />
            </div>
          </div>
          <h1 className="text-4xl font-extrabold mb-1 bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">Junte-se ao Bingola</h1>
          <p className="text-white/40 text-sm font-medium">Sua jornada de sorte começa em segundos</p>
        </div>

        <form className="space-y-4" onSubmit={handleRegister}>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-white/50 ml-1 mb-2 block">Nome de Usuário</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-white/40 text-xl group-focus-within:text-white transition-colors">person</span>
              </div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                type="text"
                placeholder="Como quer ser chamado?"
                className="input-glass block w-full h-[60px] pl-14 pr-6 rounded-2xl text-base font-medium placeholder:text-white/20 focus:ring-0 outline-none text-white transition-all"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-white/50 ml-1 mb-2 block">E-mail</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-white/40 text-xl group-focus-within:text-white transition-colors">mail</span>
              </div>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="seu@email.com"
                className="input-glass block w-full h-[60px] pl-14 pr-6 rounded-2xl text-base font-medium placeholder:text-white/20 focus:ring-0 outline-none text-white transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-white/50 ml-1 mb-2 block">Senha</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-white/40 text-xl group-focus-within:text-white transition-colors">lock</span>
                </div>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder="Mínimo 6 dígitos"
                  className="input-glass block w-full h-[60px] pl-14 pr-6 rounded-2xl text-base font-medium placeholder:text-white/20 focus:ring-0 outline-none text-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-white/50 ml-1 mb-2 block">Confirmar Senha</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <span className={`material-symbols-outlined text-xl transition-colors ${password && confirmPassword && password !== confirmPassword ? 'text-red-500' : 'text-white/40 group-focus-within:text-white'}`}>lock_reset</span>
                </div>
                <input
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  type="password"
                  placeholder="Repita sua senha"
                  className={`input-glass block w-full h-[60px] pl-14 pr-6 rounded-2xl text-base font-medium placeholder:text-white/20 focus:ring-0 outline-none text-white transition-all ${password && confirmPassword && password !== confirmPassword ? 'border-red-500/50 bg-red-500/5' : ''}`}
                />
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 px-2 py-2">
            <div className="relative flex items-center">
              <input
                type="checkbox"
                id="terms"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className={`peer h-5 w-5 cursor-pointer appearance-none rounded-md border-2 transition-all checked:bg-primary hover:border-white/40 ${!termsAccepted && error?.includes('Termos') ? 'border-red-500' : 'border-white/20 bg-white/5 checked:border-primary'}`}
              />
              <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100">
                <span className="material-symbols-outlined text-sm font-bold">check</span>
              </span>
            </div>
            <label htmlFor="terms" className="text-[11px] text-white/40 cursor-pointer select-none leading-tight font-bold uppercase tracking-wider">
              Li e concordo com os <a href="/legal/terms-of-service.html" target="_blank" className="text-primary underline">Termos</a> e <a href="/legal/privacy-policy.html" target="_blank" className="text-primary underline">Privacidade</a>
            </label>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 animate-pulse">
              <p className="text-red-500 text-[11px] font-bold uppercase tracking-widest text-center">{error}</p>
            </div>
          )}

          <div className="flex flex-col gap-3 mt-2">
            <button
              type="submit"
              disabled={loading || !termsAccepted}
              className={`w-full h-[66px] bg-gradient-to-r from-primary to-secondary text-white font-black text-lg rounded-[22px] shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:grayscale disabled:opacity-50`}
            >
              {loading ? (
                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>Criar Minha Conta <span className="material-symbols-outlined">arrow_forward</span></>
              )}
            </button>

            <div className="relative w-full my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/5"></div>
              </div>
              <div className="relative flex justify-center text-[10px]">
                <span className="px-4 bg-background-dark text-white/30 font-bold uppercase tracking-widest">Ou use Acesso Rápido</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full">
              <button
                type="button"
                disabled={loading || !termsAccepted}
                onClick={() => handleSocialLogin('google')}
                className={`flex flex-col items-center justify-center h-[64px] rounded-2xl bg-white text-black hover:bg-gray-100 transition-all active:scale-[0.98] shadow-sm disabled:grayscale disabled:opacity-20`}
              >
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"></path>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
                  </svg>
                  <span className="font-bold text-sm">Google</span>
                </div>
              </button>

              <button
                type="button"
                disabled={loading || !termsAccepted}
                onClick={() => handleSocialLogin('apple')}
                className={`flex flex-col items-center justify-center h-[64px] rounded-2xl bg-white/5 border border-white/5 text-white/20 transition-all cursor-not-allowed overflow-hidden group relative disabled:grayscale disabled:opacity-20`}
              >
                <div className="flex flex-col items-center justify-center">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-3 opacity-20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.844-1.026 1.402-2.441 1.247-3.83-1.183.052-2.61.793-3.461 1.79-.767.883-1.442 2.325-1.261 3.676 1.326.104 2.636-.61 3.475-1.636z" fill="currentColor" />
                    </svg>
                    <span className="font-bold text-sm opacity-20">Apple</span>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </form>

        <div className="mt-8 text-center space-y-4 pb-12">
          <p className="text-sm text-white/40 font-medium">
            Já joga com a gente?
            <button
              type="button"
              onClick={onBack}
              className="text-primary font-bold ml-1 hover:brightness-110 transition-colors"
            >
              Faça login
            </button>
          </p>
        </div>
      </main>
    </div>
  );
};
