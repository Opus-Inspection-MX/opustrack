import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import type { User } from "@/shared/types";

interface UserState {
  user: User | null;
  token: string | null;
  setToken: (token: string | null) => void;
  setUser: (u: User | null) => void;
  clear: () => void;
  hydrated: boolean;
  setHydrated: (v: boolean) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      clear: () => set({ user: null, token: null }),
      hydrated: false,
      setHydrated: (v) => set({ hydrated: v }),
    }),
    {
      name: "user-storage", // clave en localStorage
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);

//get user from store
export const getUserFromStore = (): User | null => {
  const store = useUserStore.getState();
  return store.user;
};
