
export interface Player {
  id: string;
  name: string;
  avatar: string;
  level: number;
  isHost?: boolean;
  status: 'online' | 'offline' | 'ready';
  bpoints: number;
  bcoins: number;
}

export interface BingoRoom {
  id: string;
  name: string;
  code: string;
  hostId: string;
  prizeType: string;
  maxPlayers: number;
  activePlayers: number;
  status: 'lobby' | 'playing' | 'interval';
}

export type AppScreen =
  | 'splash'
  | 'login'
  | 'register'
  | 'home'
  | 'lobby'
  | 'participant_lobby'
  | 'game'
  | 'host_dashboard'
  | 'store'
  | 'ranking'
  | 'profile'
  | 'winners'
  | 'customization'
  | 'messages'
  | 'room_settings'
  | 'audio_settings'
  | 'rules_settings'
  | 'chat'
  | 'edit_card'
  | 'friends';
