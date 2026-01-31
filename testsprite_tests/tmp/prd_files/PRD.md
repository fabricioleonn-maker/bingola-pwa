# PRD - Bingola: Bingo Social

## 1. Visão Geral do Produto
**Bingola** é uma plataforma de Bingo Social moderna e dinâmica, projetada para oferecer uma experiência de jogo comunitária, interativa e visualmente atraente. O aplicativo funciona como um PWA (Progressive Web App), permitindo fácil acesso em dispositivos móveis e desktop, com foco em sincronização em tempo real e engajamento social.

### Objetivos Principais
- Proporcionar uma experiência de Bingo síncrona para múltiplos jogadores.
- Facilitar a criação e gestão de salas de jogo por "Hosts" (anfitriões).
- Integrar elementos sociais como chat, rankings e premiações.
- Oferecer uma economia virtual baseada em `BPoints` e `BCoins`.

---

## 2. Público-Alvo
- Jogadores casuais de bingo que buscam entretenimento social.
- Comunidades e grupos que desejam organizar rodadas de bingo virtuais.
- Administradores de jogos (Hosts) que precisam de ferramentas de gestão de salas e jogadores.

---

## 3. Funcionalidades Principais

### 3.1. Gestão de Usuários
- **Autenticação**: Login e Registro via e-mail/senha integrado ao Supabase Auth.
- **Perfil do Usuário**: Personalização de avatar, visualização de nível, saldo de pontos (`BPoints`, `BCoins`) e estatísticas.
- **Tutorial**: Guia interativo para novos usuários entenderem as mecânicas do jogo.

### 3.2. Mecânicas de Jogo
- **Criação de Salas**: Hosts podem criar salas com configurações personalizadas (nome, tipo de prêmio, intervalo de sorteio).
- **Entrada em Salas**: Jogadores entram via código da sala ou convite.
- **Sorteio em Tempo Real**: Sistema de sorteio automático e síncrono gerenciado pelo Host.
- **Cartela Dinâmica**: Geração automática de cartelas e marcação manual ou assistida.
- **Celebração de Vitória**: Animações de confete e efeitos sonoros exclusivos para vencedores de "BINGO!" e prêmios secundários.

### 3.3. Elementos Sociais
- **Chat**: Chat global e por sala com suporte a mensagens rápidas e emojis.
- **Mensagens**: Central de mensagens para notificações de amizade e sistema.
- **Amigos e Social**: Sistema de amizades para convites rápidos.
- **Rankings**: Competição global baseada em `BPoints`.

### 3.4. Economia e Customização
- **Loja (Store)**: Compra de itens cosméticos e boosters.
- **Customização**: Personalização visual da interface (Temas, fontes, cores).
- **Master Hub**: Painel administrativo para controle econômico e de assinaturas.

---

## 4. Stack Tecnológica
- **Frontend**: React (v19), Vite (v6).
- **Estilização**: Tailwind CSS (com estética rica/neon).
- **Estado**: Zustand (Global Store).
- **Backend**: Supabase (Database, Auth, Realtime Broadcast).
- **Mobile/PWA**: Capacitor (Android), Vite-PWA.
- **Efeitos**: canvas-confetti (Celebrações).

---

## 5. Fluxos do Usuário

### 5.1. Fluxo do Jogador (Participante)
1. **SplashScreen** -> **Login/Register**
2. **HomeScreen**: Escolhe entrar em uma sala pública ou privada.
3. **ParticipantLobby**: Aguarda o Host iniciar a partida.
4. **GameScreen**: Marca os números enquanto escuta a narração.
5. **Vitória**: Clica em "BINGO!", assiste às celebrações e recebe prêmios.

### 5.2. Fluxo do Anfitrião (Host)
1. **HomeScreen** -> **HostDashboard**
2. **Criação/Gestão de Sala**: Configura prêmios e regras.
3. **LobbyScreen**: Gerencia entrada de jogadores e aceita/rejeita participantes.
4. **GameScreen**: Controla o ritmo do sorteio (Play/Pause).

---

## 6. Regras de Negócio e Segurança
- **Sincronização**: O estado da sala (`drawn_numbers`) é a fonte da verdade para todos os jogadores.
- **Garantia de Sorteio**: Proteção contra reinicialização acidental de rounds (`PersistentGameLoop`).
- **RLS (Supabase)**: Políticas de segurança para garantir que usuários só acessem dados autorizados.
- **Auto-Logout**: Desconexão automática após 10 minutos de inatividade para economia de recursos.

---

## 7. Requisitos não Funcionais
- **Performance**: Carregamento rápido (< 3s para First Contentful Paint).
- **Acessibilidade**: Narração de voz para números sorteados.
- **Responsividade**: Layout adaptável para smartphones, tablets e desktops.
