import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isNewUser: boolean;
  // Actions
  setAuth: (user: User, accessToken: string, refreshToken: string, isNewUser?: boolean) => void;
  updateUser: (partial: Partial<User>) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isNewUser: false,

      setAuth: (user, accessToken, refreshToken, isNewUser = false) =>
        set({ user, accessToken, refreshToken, isNewUser }),

      updateUser: (partial) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partial } : null,
        })),

      clearAuth: () =>
        set({ user: null, accessToken: null, refreshToken: null, isNewUser: false }),
    }),
    {
      name: "auth-storage", // localStorage key
    }
  )
);
