import { create } from 'zustand';

interface SyncState {
    isSyncing: boolean;
    pendingCount: number;
    lastSyncTime: string | null;
    error: string | null;
    isPaused: boolean;
    setSyncing: (isSyncing: boolean) => void;
    setPaused: (isPaused: boolean) => void;
    setPendingCount: (count: number) => void;
    setLastSyncTime: (time: string) => void;
    setError: (error: string | null) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
    isSyncing: false,
    pendingCount: 0,
    lastSyncTime: null,
    error: null,
    isPaused: false,
    setSyncing: (isSyncing) => set({ isSyncing }),
    setPaused: (isPaused) => set({ isPaused }),
    setPendingCount: (pendingCount) => set({ pendingCount }),
    setLastSyncTime: (lastSyncTime) => set({ lastSyncTime }),
    setError: (error) => set({ error }),
}));
