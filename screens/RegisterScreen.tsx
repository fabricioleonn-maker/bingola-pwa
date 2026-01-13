
import React, { useState } from 'react';

interface Props {
  onBack: () => void;
  onComplete: () => void;
}

export const RegisterScreen: React.FC<Props> = ({ onBack, onComplete }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validações básicas
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setError('Por favor, preencha todos os campos.');
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

    // Tenta salvar o novo usuário
    try {
      const savedUsers = JSON.parse(localStorage.getItem('bingola_users') || '[]');

      // Verificar se o e-mail já existe
      if (savedUsers.some((u: any) => u.email.toLowerCase() === email.toLowerCase())) {
        setError('Este e-mail já está sendo usado por outro jogador.');
        return;
      }

      const newUser = {
        id: Date.now().toString(),
        name,
        email,
        password,
        createdAt: new Date().toISOString(),
        bcoins: 100, // Saldo inicial
        level: 1
      };

      savedUsers.push(newUser);
      localStorage.setItem('bingola_users', JSON.stringify(savedUsers));

      // Salva como usuário logado e prossegue
      localStorage.setItem('bingola_current_user', JSON.stringify(newUser));
      onComplete();
    } catch (e) {
      setError('Erro ao salvar dados. Verifique o armazenamento do navegador.');
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col relative overflow-hidden">
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

        <form className="space-y-4 pb-10" onSubmit={handleRegister}>
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

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 animate-bounce">
              <p className="text-red-500 text-[11px] font-bold uppercase tracking-widest text-center">{error}</p>
            </div>
          )}

          <button
            type="submit"
            className="w-full h-[66px] bg-gradient-to-r from-primary to-secondary text-white font-black text-lg rounded-[22px] shadow-xl shadow-primary/20 mt-6 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            Criar Minha Conta <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        </form>

        <div className="mt-2 text-center pb-12">
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
