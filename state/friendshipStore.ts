import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Friendship } from './types';

interface FriendshipStore {
    friends: Friendship[];
    pendingIncoming: Friendship[];
    pendingOutgoing: Friendship[];
    fetchFriends: () => Promise<void>;
    searchUsers: (query: string) => Promise<any[]>;
    sendRequest: (friendId: string) => Promise<void>;
    acceptRequest: (requestId: string) => Promise<void>;
    rejectRequest: (requestId: string) => Promise<void>;
    removeFriend: (friendId: string) => Promise<void>;
    subscribe: () => () => void;
}

export const useFriendshipStore = create<FriendshipStore>((set, get) => ({
    friends: [],
    pendingIncoming: [],
    pendingOutgoing: [],

    fetchFriends: async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Use independent selects for clarity and robustness against deep-link relationship naming issues
            const { data, error } = await supabase
                .from('friendships')
                .select(`
                    *,
                    friend:friend_id(username, avatar_url, level, bcoins),
                    requester:user_id(username, avatar_url, level, bcoins)
                `)
                .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

            if (error) {
                console.error("[Friendship] Fetch error:", error);
                return;
            }

            if (data) processFriendData(data, user.id);
        } catch (e) {
            console.error("[Friendship] Unexpected error:", e);
        }

        function processFriendData(data: any[], currentUserId: string) {
            const accepted = data.filter(f => f.status === 'accepted').map(f => {
                const isRequester = f.user_id === currentUserId;
                const profile = isRequester ? f.friend : f.requester;
                // CRITICAL FIX: Normalize friend_id to always be the OTHER person
                // This ensures selectedFriendId is never ME, fixing the Private Chat identity bug.
                return {
                    ...f,
                    friend_id: isRequester ? f.friend_id : f.user_id, // Swap if I am the acceptor
                    user_id: currentUserId, // Verify I am always user_id in local state
                    friend_profiles: profile
                };
            });
            const incoming = data.filter(f => f.status === 'pending' && f.friend_id === currentUserId).map(f => ({
                ...f,
                friend_profiles: f.requester
            }));
            const outgoing = data.filter(f => f.status === 'pending' && f.user_id === currentUserId).map(f => ({
                ...f,
                friend_profiles: f.friend
            }));

            set({ friends: accepted as any, pendingIncoming: incoming as any, pendingOutgoing: outgoing as any });
        }
    },

    subscribe: () => {
        const fetch = get().fetchFriends;
        const channel = supabase.channel('friendship_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'friendships' },
                () => {
                    console.log("[Friendship] Realtime event triggered fetch.");
                    fetch();
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    },

    searchUsers: async (query) => {
        if (!query.trim()) return [];
        const { data: { user } } = await supabase.auth.getUser();

        const { data } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .ilike('username', `%${query}%`)
            .neq('id', user?.id)
            .limit(10);

        return data || [];
    },

    sendRequest: async (friendId) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Check local state for duplicates to prevent redundant DB calls
        const s = get();
        const alreadyFriend = s.friends.some(f => f.friend_id === friendId || f.user_id === friendId);
        const alreadyPending = s.pendingOutgoing.some(f => f.friend_id === friendId) ||
            s.pendingIncoming.some(f => f.user_id === friendId);

        if (alreadyFriend || alreadyPending) {
            console.log("[Friendship] Request already exists or user is already a friend.");
            return;
        }

        await supabase.from('friendships').insert({
            user_id: user.id,
            friend_id: friendId,
            status: 'pending'
        });
        get().fetchFriends();
    },

    acceptRequest: async (requestId) => {
        await supabase
            .from('friendships')
            .update({ status: 'accepted' })
            .eq('id', requestId);
        get().fetchFriends();
    },

    rejectRequest: async (requestId) => {
        await supabase.from('friendships').delete().eq('id', requestId);
        get().fetchFriends();
    },

    removeFriend: async (friendId) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await supabase
            .from('friendships')
            .delete()
            .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},user_id.eq.${user.id})`);
        get().fetchFriends();
    }
}));
