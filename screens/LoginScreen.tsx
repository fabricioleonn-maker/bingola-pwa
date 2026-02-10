import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNotificationStore } from '../state/notificationStore';
import { LoginProps } from '../types';
import { signInWithGoogle, signInWithApple } from '../lib/authService';
import { Capacitor } from '@capacitor/core';

export const LoginScreen: React.FC<LoginProps> = ({ onLogin, onGoToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Auto-fill email if previously saved
  useEffect(() => {
    const savedEmail = localStorage.getItem('bingola_last_email');
    const savedRemember = localStorage.getItem('bingola_remember_me');

    if (savedRemember === 'false') {
      setRememberMe(false);
    } else {
      if (savedEmail) setEmail(savedEmail);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email || !password) {
      setErrorMsg('Por favor, preencha todos os campos.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        let msg = error.message;
        if (msg === 'Invalid login credentials') msg = 'E-mail ou senha incorretos.';
        setErrorMsg(msg);
        useNotificationStore.getState().show(msg, 'error');
        return;
      }

      if (data.session) {
        if (rememberMe) {
          localStorage.setItem('bingola_last_email', email);
          localStorage.setItem('bingola_remember_me', 'true');
        } else {
          localStorage.removeItem('bingola_last_email');
          localStorage.setItem('bingola_remember_me', 'false');
        }
        onLogin();
      }
    } catch (e: any) {
      setErrorMsg('Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordLink = async () => {
    if (!email) {
      setErrorMsg('Digite seu e-mail para recuperar a senha.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
      });
      if (error) throw error;
      useNotificationStore.getState().show('E-mail de recuperação enviado!', 'success');
    } catch (error: any) {
      setErrorMsg(error.message);
      useNotificationStore.getState().show(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { error } = provider === 'google' ? await signInWithGoogle() : await signInWithApple();
      if (error) {
        setErrorMsg(error.message);
        useNotificationStore.getState().show(error.message, 'error');
      } else if (Capacitor.isNativePlatform()) {
        onLogin();
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setTimeout(() => setLoading(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-between px-6 py-10 relative overflow-hidden">
      {/* Background Decorativo */}
      <div className="absolute inset-0 opacity-40 pointer-events-none z-0">
        <div className="absolute top-[10%] right-[15%] w-[40vw] h-[40vw] bg-primary/20 rounded-full blur-[80px]"></div>
        <div className="absolute bottom-[20%] left-[10%] w-[50vw] h-[50vw] bg-secondary/15 rounded-full blur-[100px]"></div>
      </div>

      <main className="w-full max-w-[390px] flex flex-col items-center relative z-10 flex-1">
        <div className="mt-4 mb-8 flex flex-col items-center text-center">
          <div className="relative mb-6 animate-float-slow">
            <div className="w-24 h-24 rounded-3xl overflow-hidden border-4 border-white/10 shadow-2xl">
              <img src="/pwa-512x512.png" alt="Bingola Logo" className="w-full h-full object-cover" />
            </div>
          </div>
          <h1 className="text-6xl font-rounded font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#ff3d71] via-[#d946ef] to-[#9333ea] mb-2 leading-none py-2">
            Bingola
          </h1>
          <p className="text-white/90 font-semibold text-base tracking-wide">A sua sorte começa aqui</p>
        </div>

        <form className="w-full space-y-5" onSubmit={handleLogin}>
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-white/50 ml-1">E-mail ou Usuário</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                <span className={`material-symbols-outlined text-xl transition-colors ${errorMsg && errorMsg.includes('Usuário') ? 'text-red-500' : 'text-white/40 group-focus-within:text-white'}`}>alternate_email</span>
              </div>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-glass block w-full h-[60px] pl-14 pr-6 rounded-2xl text-base font-medium placeholder:text-white/20 focus:ring-0 outline-none text-white transition-all"
                placeholder="nome@exemplo.com"
                type="text"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-white/50 ml-1">Senha</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                <span className={`material-symbols-outlined text-xl transition-colors ${errorMsg && errorMsg.includes('Senha') ? 'text-red-500' : 'text-white/40 group-focus-within:text-white'}`}>lock_person</span>
              </div>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-glass block w-full h-[60px] pl-14 pr-14 rounded-2xl text-base font-medium placeholder:text-white/20 focus:ring-0 outline-none text-white transition-all"
                placeholder="••••••••"
                type={showPassword ? "text" : "password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-5 flex items-center text-white/40 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">{showPassword ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>

            <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="peer h-4 w-4 appearance-none rounded border border-white/20 bg-white/5 checked:bg-primary checked:border-primary transition-all cursor-pointer"
                  />
                  <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-black text-[10px] font-bold opacity-0 peer-checked:opacity-100">
                    <span className="material-symbols-outlined text-[12px]">check</span>
                  </span>
                </div>
                <span className="text-[11px] font-bold text-white/40 group-hover:text-white/60 transition-colors uppercase tracking-wider">Lembrar conta</span>
              </label>

              <button
                type="button"
                onClick={handleResetPasswordLink}
                className="text-xs font-bold text-[#a855f7] hover:text-[#d946ef] transition-colors"
                disabled={loading}
              >
                Esqueceu a senha?
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 animate-pulse">
              <p className="text-red-500 text-[11px] font-bold uppercase tracking-widest text-center">{errorMsg}</p>
            </div>
          )}

          <div className="flex flex-col gap-3 mt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[60px] bg-gradient-to-r from-[#ff3d71] to-[#ff8c42] text-white font-black text-lg rounded-[20px] shadow-xl shadow-pink-500/20 transition-all flex items-center justify-center disabled:grayscale disabled:opacity-20"
            >
              {loading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : "Iniciar sua sorte"}
            </button>

            {loading && (
              <button
                type="button"
                onClick={() => setLoading(false)}
                className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 hover:text-white/40 transition-colors py-2"
              >
                Cancelar e Voltar
              </button>
            )}
          </div>
        </form>

        {!loading && (
          <>
            <div className="relative w-full my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/5"></div>
              </div>
              <div className="relative flex justify-center text-[10px]">
                <span className="px-4 bg-black text-white/30 font-bold uppercase tracking-widest">Acesso Rápido</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleSocialLogin('google')}
                className="flex flex-col items-center justify-center h-[64px] rounded-2xl bg-white text-black hover:bg-gray-100 transition-all active:scale-[0.98] shadow-sm disabled:grayscale disabled:opacity-20"
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
                disabled={loading}
                onClick={() => handleSocialLogin('apple')}
                className="flex flex-col items-center justify-center h-[64px] rounded-2xl bg-white/5 border border-white/5 text-white/20 transition-all cursor-not-allowed overflow-hidden group relative disabled:grayscale disabled:opacity-20"
              >
                <div className="flex flex-col items-center justify-center">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-3 opacity-20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.844-1.026 1.402-2.441 1.247-3.83-1.183.052-2.61.793-3.461 1.79-.767.883-1.442 2.325-1.261 3.676 1.326.104 2.636-.61 3.475-1.636z" fill="currentColor" />
                    </svg>
                    <span className="font-bold text-sm opacity-20">Apple</span>
                  </div>
                  <span className="text-[8px] font-black uppercase tracking-tighter mt-1">Em desenvolvimento</span>
                </div>
              </button>
            </div>
          </>
        )}

        <div className="mt-8 text-center">
          <p className="text-sm text-white/40 font-medium">
            Novo por aqui?
            <button
              type="button"
              onClick={onGoToRegister}
              className="text-primary font-bold ml-1 hover:brightness-110 transition-colors"
            >
              Criar conta grátis
            </button>
          </p>
        </div>
      </main>
    </div>
  );
};
