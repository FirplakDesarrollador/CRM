import { create } from 'zustand';

interface SyncState {
    isOnline: boolean;
    isSyncing: boolean;
    isProcessing: boolean;
    pendingCount: number;
    lastSyncTime: string | null;
    error: string | null;
    isPaused: boolean;
    userRole: 'SALES' | 'COORDINATOR' | 'ADMIN';

    setOnline: (status: boolean) => void;
    setSyncing: (isSyncing: boolean) => void;
    setProcessing: (isProcessing: boolean) => void;
    setPaused: (isPaused: boolean) => void;
    setPendingCount: (count: number) => void;
    setLastSyncTime: (time: string) => void;
    setError: (error: string | null) => void;
    setUserRole: (role: 'SALES' | 'COORDINATOR' | 'ADMIN') => void;
}

export const useSyncStore = create<SyncState>((set) => ({
    isOnline: true,
    isSyncing: false,
    isProcessing: false,
    pendingCount: 0,
    lastSyncTime: null,
    error: null,
    isPaused: false,
    userRole: 'ADMIN',

    setOnline: (status) => set({ isOnline: status }),
    setSyncing: (isSyncing) => set({ isSyncing }),
    setProcessing: (isProcessing) => set({ isProcessing }),
    setPaused: (isPaused) => set({ isPaused }),
    setPendingCount: (pendingCount) => set({ pendingCount }),
    setLastSyncTime: (lastSyncTime) => set({ lastSyncTime }),
    setError: (error) => set({ error }),
    setUserRole: (role) => set({ userRole: role }),
}));
