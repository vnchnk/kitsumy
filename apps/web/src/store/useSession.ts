import { create } from 'zustand';
import { AppMode } from '@kitsumy/types';

interface SessionState {
  mode: AppMode;
  userAvatarStatus: 'happy' | 'bored' | 'sad';
  setMode: (mode: AppMode) => void;
  updateAvatar: (lastLogin: Date) => void;
}

export const useSession = create<SessionState>((set) => ({
  mode: AppMode.LEARNING,
  userAvatarStatus: 'happy',
  
  setMode: (mode) => set({ mode }),
  
  updateAvatar: (lastLogin) => {
    const hours = (new Date().getTime() - lastLogin.getTime()) / 36e5;
    if (hours > 24) set({ userAvatarStatus: 'bored' });
  }
}));

