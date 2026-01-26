export type RoomStatus = 'lobby' | 'playing' | 'finished';

export type ParticipantStatus = 'pending' | 'accepted' | 'rejected';

export type Room = {
    id: string;
    code: string;
    name: string;
    host_id: string;
    status: RoomStatus;
    drawn_numbers: number[];
    updated_at?: string;
    player_limit?: number;
    current_round?: number;
    prize_pool?: number;
    rounds?: number;
    winning_patterns?: {
        cheia?: boolean;
        cinquina?: boolean;
        cantos?: boolean;
        x?: boolean;
    };
    draw_interval?: number;
};

export type Participant = {
    id: string;
    room_id: string;
    user_id: string;
    status: ParticipantStatus;
    created_at?: string;
    profiles?: {
        username?: string;
        avatar_url?: string;
        level?: number;
        bcoins?: number;
    };
};
export type Message = {
    id: string;
    room_id?: string;
    sender_id: string;
    receiver_id?: string;
    content: string;
    created_at: string;
    profiles?: {
        username: string;
        avatar_url: string;
    }
};

export type Friendship = {
    id: string;
    user_id: string;
    friend_id: string;
    status: 'pending' | 'accepted' | 'blocked';
    friend_profiles?: {
        username: string;
        avatar_url: string;
    }
};
