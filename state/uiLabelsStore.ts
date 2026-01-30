
import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface UILabelsStore {
    labels: Record<string, string>;
    loading: boolean;
    fetchLabels: () => Promise<void>;
    getLabel: (id: string, defaultText: string) => string;
}

export const useUILabels = create<UILabelsStore>((set, get) => ({
    labels: {},
    loading: false,

    fetchLabels: async () => {
        set({ loading: true });
        try {
            const { data, error } = await supabase
                .from('ui_labels')
                .select('element_id, label');

            if (error) {
                // If table doesn't exist, we just fail gracefully with empty labels
                console.warn("[UILabels] Table lookup failed (possibly not created yet).");
                return;
            }

            const labelMap: Record<string, string> = {};
            data?.forEach(item => {
                labelMap[item.element_id] = item.label;
            });

            set({ labels: labelMap });
        } catch (e) {
            console.error("[UILabels] Fetch error:", e);
        } finally {
            set({ loading: false });
        }
    },

    getLabel: (id, defaultText) => {
        return get().labels[id] || defaultText;
    }
}));
