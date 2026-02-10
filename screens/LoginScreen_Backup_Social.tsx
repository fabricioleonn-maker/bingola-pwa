
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAudioStore } from '../state/audioStore';
import { useNotificationStore } from '../state/notificationStore';
import { signInWithGoogle, signInWithApple } from '../lib/authService';
import { Capacitor } from '@capacitor/core';

interface LoginProps {
  onLogin: () => void;
  onGoToRegister: () => void;
}

export const LoginScreen: React.FC<LoginProps> = ({ onLogin, onGoToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Auto-fill email if previously saved
  useEffect(() => {
    const savedEmail = localStorage.getItem('bingola_last_email');
    if (savedEmail) setEmail(savedEmail);
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
        localStorage.setItem('bingola_last_email', email);
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

  return (
    <div className="min-h-[100dvh] bg-black flex flex-col items-center justify-start pb-12 relative overflow-hidden">
      {/* Estrelas de Fundo (Padrão SplashScreen) */}
      <div className="absolute inset-0 z-0">
        <div className="star w-[1px] h-[1px] top-[5%] left-[12%] opacity-90"></div>
        <div className="star w-[2px] h-[2px] top-[8%] left-[45%] opacity-100"></div>
        <div className="star w-[1px] h-[1px] top-[15%] left-[85%] opacity-70"></div>
        <div className="star w-[1px] h-[1px] top-[18%] left-[25%] opacity-80"></div>
        <div className="star w-[2px] h-[2px] top-[12%] left-[65%] opacity-90"></div>
        <div className="star w-[1.5px] h-[1.5px] top-[22%] left-[40%] opacity-100"></div>
      </div>

      {/* Bolas de Bingo caindo (Padrão SplashScreen) */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="bingo-ball w-12 h-12 left-[10%] -top-12 animate-fall-slow opacity-60" style={{ animationDelay: '0s' }}>23</div>
        <div className="bingo-ball w-10 h-10 left-[85%] -top-12 animate-fall-slow opacity-50" style={{ animationDelay: '1.5s' }}>07</div>
        <div className="bingo-ball w-14 h-14 left-[45%] -top-12 animate-fall-slow opacity-40" style={{ animationDelay: '3s' }}>41</div>
        <div className="bingo-ball w-16 h-16 left-[25%] -top-16 animate-fall-medium opacity-80 z-10" style={{ animationDelay: '0.5s' }}>15</div>
        <div className="bingo-ball w-20 h-20 left-[60%] -top-20 animate-fall-medium opacity-75 z-10" style={{ animationDelay: '2s' }}>66</div>
        <div className="bingo-ball w-24 h-24 left-[35%] -top-24 animate-fall-fast blur-[1px] z-20" style={{ animationDelay: '1s' }}>B</div>
        <div className="bingo-ball w-20 h-20 left-[15%] -top-20 animate-fall-fast blur-[1px] z-20" style={{ animationDelay: '4s' }}>99</div>
      </div>

      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pink-900/10 blur-[180px] rounded-full"></div>

      <main className="relative z-30 flex flex-col items-center w-full max-w-md px-8 pt-12">
        {/* Logo e Título */}
        <div className="flex flex-col items-center mb-8">
          <div className="mb-6 animate-float-slow">
            <div className="w-24 h-24 rounded-[32px] overflow-hidden border-4 border-white/10 shadow-2xl shadow-pink-500/10">
              <img src="/pwa-512x512.png" alt="Bingola Logo" className="w-full h-full object-cover" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <h1 className="text-8xl font-black gradient-text tracking-tighter drop-shadow-2xl leading-none py-2">
              Bingola
            </h1>
            <p className="text-white text-lg font-bold">
              A sua sorte começa aqui
            </p>
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={handleLogin} className="w-full space-y-5">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2 block pl-1">E-MAIL OU USUÁRIO</label>
            <div className="relative group">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="text"
                className="input-glass block w-full h-[64px] px-6 rounded-2xl text-base font-medium placeholder:text-white/10 focus:ring-0 outline-none text-white transition-all"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2 block pl-1">SENHA</label>
            <div className="relative group">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? 'text' : 'password'}
                className="input-glass block w-full h-[64px] px-6 pr-14 rounded-2xl text-base font-medium placeholder:text-white/10 focus:ring-0 outline-none text-white transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors p-2"
              >
                <span className="material-symbols-outlined text-xl">{showPassword ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={handleResetPasswordLink}
                className="text-[10px] font-bold uppercase tracking-widest text-primary/80 hover:text-primary transition-colors"
              >
                Esqueceu a senha?
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              <p className="text-red-500 text-[11px] font-bold uppercase tracking-widest text-center">{errorMsg}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full h-[70px] bg-gradient-to-r from-primary to-[#ff843d] text-white font-black text-xl rounded-[24px] shadow-2xl shadow-primary/20 active:scale-[0.98] transition-all flex items-center justify-center ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {loading ? (
              <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              "Iniciar sua sorte"
            )}
          </button>

          <div className="relative w-full py-4 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5"></div>
            </div>
            <span className="relative px-4 bg-black text-[10px] font-black uppercase tracking-[0.3em] text-white/20">ACESSO RÁPIDO</span>
          </div>

          <div className="flex gap-4">
            <button
              onClick={async () => {
                setLoading(true);
                const { error } = await signInWithGoogle();
                if (error) {
                  setErrorMsg(error.message);
                  useNotificationStore.getState().show(error.message, 'error');
                } else if (Capacitor.isNativePlatform()) {
                  onLogin();
                }
                setLoading(false);
              }}
              disabled={loading}
              className="flex-1 flex items-center justify-center h-[64px] rounded-2xl bg-white text-black hover:bg-gray-100 transition-all active:scale-[0.98] font-bold text-sm shadow-xl"
              type="button"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"></path>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
              </svg>
              Google
            </button>
            <button
              onClick={async () => {
                setLoading(true);
                const { error } = await signInWithApple();
                if (error) {
                  setErrorMsg(error.message);
                  useNotificationStore.getState().show(error.message, 'error');
                } else if (Capacitor.isNativePlatform()) {
                  onLogin();
                }
                setLoading(false);
              }}
              disabled={loading}
              className="flex-1 flex items-center justify-center h-[64px] rounded-2xl bg-white text-black hover:bg-gray-100 transition-all active:scale-[0.98] font-bold text-sm shadow-xl"
              type="button"
            >
              <span className="material-symbols-outlined mr-3">apple</span>
              Apple
            </button>
          </div>
        </form>

        <footer className="mt-16 text-center space-y-6">
          <div className="flex justify-center items-center gap-4">
            <a href="/legal/privacy-policy.html" target="_blank" className="text-white/40 text-[11px] font-bold uppercase tracking-widest hover:text-white transition-colors underline decoration-white/10 underline-offset-4">Privacidade</a>
            <span className="text-white/10">•</span>
            <a href="/legal/terms-of-service.html" target="_blank" className="text-white/40 text-[11px] font-bold uppercase tracking-widest hover:text-white transition-colors underline decoration-white/10 underline-offset-4">Termos de Uso</a>
          </div>

          <p className="text-sm text-white/40 font-medium tracking-wide">
            Novo por aqui?
            <button
              type="button"
              onClick={onGoToRegister}
              className="text-[#ff3d71] font-black ml-2 hover:brightness-110 transition-colors"
            >
              Criar conta grátis
            </button>
          </p>
        </footer>
      </main>
    </div>
  );
};
