import { create } from 'zustand';

interface SyncState {
    isOnline: boolean;
    isSyncing: boolean;
    pendingChanges: number;
    lastSyncTime: Date | null;
    syncError: string | null;
    userRole: 'SALES' | 'COORDINATOR' | 'ADMIN';

    setOnline: (status: boolean) => void;
    setSyncing: (status: boolean) => void;
    setPendingChanges: (count: number) => void;
    setSyncError: (error: string | null) => void;
    setUserRole: (role: 'SALES' | 'COORDINATOR' | 'ADMIN') => void;
    completedSync: () => void;
}

export const useSyncStore = create<SyncState>((set) => ({
    isOnline: true, // Default true for SSR safety, updated by effect in AppLayout
    isSyncing: false,
    pendingChanges: 0,
    lastSyncTime: null,
    syncError: null,
    userRole: 'ADMIN', // Default role

    setOnline: (status) => set({ isOnline: status }),
    setSyncing: (status) => set({ isSyncing: status }),
    setPendingChanges: (count) => set({ pendingChanges: count }),
    setSyncError: (error) => set({ syncError: error }),
    setUserRole: (role) => set({ userRole: role }),
    completedSync: () => set({ isSyncing: false, lastSyncTime: new Date(), syncError: null }),
}));
