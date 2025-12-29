import { create } from 'zustand';
import { AppMode } from '@kitsumy/types';

interface SessionState {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
}

export const useSession = create<SessionState>((set) => ({
  mode: AppMode.LEARNING,
  setMode: (mode) => set({ mode }),
}));
