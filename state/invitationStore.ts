import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface Invitation {
    id: string;
    room_id: string;
    host_id: string;
    invitee_id: string;
    status: 'pending' | 'accepted' | 'rejected';
    room_name?: string;
    host_name?: string;
}

interface InvitationStore {
    outgoing: Invitation[];
    incoming: Invitation[];
    sendInvite: (roomId: string, friendId: string) => Promise<void>;
    fetchIncoming: () => Promise<void>;
    respondToInvite: (inviteId: string, status: 'accepted' | 'rejected') => Promise<void>;
}

export const useInvitationStore = create<InvitationStore>((set, get) => ({
    outgoing: [],
    incoming: [],

    sendInvite: async (roomId, friendId) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await supabase.from('room_invitations').insert({
            room_id: roomId,
            host_id: user.id,
            invitee_id: friendId,
            status: 'pending'
        });
    },

    fetchIncoming: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from('room_invitations')
            .select('*, rooms(name), profiles:host_id(username)')
            .eq('invitee_id', user.id)
            .eq('status', 'pending');

        if (data) {
            const invitations = data.map(inv => ({
                ...inv,
                room_name: inv.rooms?.name,
                host_name: inv.profiles?.username
            }));
            set({ incoming: invitations as any });
        }
    },

    respondToInvite: async (inviteId, status) => {
        await supabase
            .from('room_invitations')
            .update({ status })
            .eq('id', inviteId);

        get().fetchIncoming();
    }
}));
