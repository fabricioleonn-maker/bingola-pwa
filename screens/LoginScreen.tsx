
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAudioStore } from '../state/audioStore';

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email || !password) {
      setErrorMsg('Por favor, preencha todos os campos.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setErrorMsg('E-mail ou senha incorretos.');
        } else if (error.message.includes('Email not confirmed')) {
          setErrorMsg('E-mail pendente de confirmação.');
        } else {
          setErrorMsg(error.message);
        }
        return;
      }

      // Success! App.tsx will handle the session change
      useAudioStore.getState().setGenre('00INTRO');
      useAudioStore.setState({ currentTrackIndex: 1, isPlaying: true });
      onLogin();
    } catch (e) {
      setErrorMsg('Erro ao realizar login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background-dark text-white font-sans relative overflow-hidden flex flex-col pb-[env(safe-area-inset-bottom)]">
      {/* Background Decorativo - Glows */}
      <div className="absolute inset-0 opacity-40 pointer-events-none z-0">
        <div className="absolute top-[10%] right-[15%] w-[40vw] h-[40vw] bg-primary/20 rounded-full blur-[80px]"></div>
        <div className="absolute bottom-[20%] left-[10%] w-[50vw] h-[50vw] bg-secondary/15 rounded-full blur-[100px]"></div>
      </div>

      {/* Bolas de Bingo caindo (Identico ao Splash) */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-20">
        <div className="bingo-ball w-12 h-12 left-[10%] -top-12 animate-fall-slow" style={{ animationDelay: '0s' }}>23</div>
        <div className="bingo-ball w-10 h-10 left-[85%] -top-12 animate-fall-slow" style={{ animationDelay: '1.5s' }}>07</div>
        <div className="bingo-ball w-14 h-14 left-[45%] -top-12 animate-fall-slow" style={{ animationDelay: '3s' }}>41</div>
        <div className="bingo-ball w-16 h-16 left-[25%] -top-16 animate-fall-medium" style={{ animationDelay: '0.5s' }}>15</div>
        <div className="bingo-ball w-20 h-20 left-[60%] -top-20 animate-fall-medium" style={{ animationDelay: '2s' }}>66</div>
        <div className="bingo-ball w-24 h-24 left-[35%] -top-24 animate-fall-fast blur-[1px]" style={{ animationDelay: '1s' }}>B</div>
        <div className="bingo-ball w-20 h-20 left-[15%] -top-20 animate-fall-fast blur-[1px]" style={{ animationDelay: '4s' }}>99</div>
      </div>

      <main className="w-full max-w-md w-11/12 mx-auto flex flex-col items-center relative z-10 flex-1 justify-between py-8">
        <div className="flex flex-col items-center w-full">
          <div className="mt-4 mb-6 flex flex-col items-center text-center">
            <div className="relative mb-6 animate-float-slow">
              <div className="w-24 h-24 rounded-3xl overflow-hidden border-4 border-white/10 shadow-2xl">
                <img src="/pwa-512x512.png" alt="Bingola Logo" className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-[70%] h-2 bg-black/20 rounded-full blur-sm"></div>
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
                  className={`input-glass block w-full h-[60px] pl-14 pr-6 rounded-2xl text-base font-medium placeholder:text-white/20 focus:ring-0 outline-none text-white transition-all ${errorMsg && errorMsg.includes('Usuário') ? 'border-red-500/50 bg-red-500/5' : ''}`}
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
                  className={`input-glass block w-full h-[60px] pl-14 pr-14 rounded-2xl text-base font-medium placeholder:text-white/20 focus:ring-0 outline-none text-white transition-all ${errorMsg && errorMsg.includes('Senha') ? 'border-red-500/50 bg-red-500/5' : ''}`}
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
              <div className="flex justify-end pr-1">
                <button type="button" className="text-xs font-bold text-[#a855f7] hover:text-[#d946ef] transition-colors">
                  Esqueceu a senha?
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 animate-pulse">
                <p className="text-red-500 text-[11px] font-bold uppercase tracking-widest text-center">{errorMsg}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full h-[60px] bg-gradient-to-r from-[#ff3d71] to-[#ff8c42] hover:brightness-110 text-white font-bold text-lg rounded-[20px] shadow-xl shadow-pink-500/20 transition-all transform active:scale-[0.98] mt-4 flex items-center justify-center ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {loading ? (
                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                'Iniciar sua sorte'
              )}
            </button>
          </form>

          <div className="relative w-full my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5"></div>
            </div>
            <div className="relative flex justify-center text-[10px]">
              <span className="px-4 bg-black text-white/30 font-bold uppercase tracking-widest">Acesso Rápido</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full">
            <button className="flex items-center justify-center h-[56px] rounded-2xl bg-white text-black hover:bg-gray-100 transition-all active:scale-[0.98] shadow-sm">
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"></path>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
              </svg>
              <span className="font-bold text-sm">Google</span>
            </button>
            <button className="flex items-center justify-center h-[56px] rounded-2xl bg-white text-black hover:bg-gray-100 transition-all active:scale-[0.98] shadow-sm">
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.844-1.026 1.402-2.441 1.247-3.83-1.183.052-2.61.793-3.461 1.79-.767.883-1.442 2.325-1.261 3.676 1.326.104 2.636-.61 3.475-1.636z" fill="black" />
              </svg>
              <span className="font-bold text-sm">Apple</span>
            </button>
          </div>
        </div>
      </main>

      <footer className="w-full py-4 text-center z-10">
        <p className="text-white/40 text-sm font-medium">
          Novo por aqui?
          <button
            type="button"
            onClick={onGoToRegister}
            className="text-[#ff386c] font-bold hover:brightness-110 transition-colors ml-1"
          >
            Criar conta grátis
          </button>
        </p>
      </footer>
    </div>
  );
};
