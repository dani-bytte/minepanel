import { create } from "zustand";
import {
  getCurrentUser,
  logout as logoutService,
} from "@/services/auth/auth.service";

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  username: string;
  checkAuthentication: () => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isLoading: true,
  username: "",

  checkAuthentication: async () => {
    const user = await getCurrentUser();
    set({
      isAuthenticated: !!user,
      username: user?.username || "",
      isLoading: false,
    });
  },

  logout: async () => {
    await logoutService();
    set({ isAuthenticated: false, username: "" });
  },

  initialize: async () => {
    try {
      const user = await getCurrentUser();
      set({ isAuthenticated: !!user, username: user?.username || "", isLoading: false });
    } catch (error) {
      console.error("Error initializing auth:", error);
      set({ isAuthenticated: false, username: "", isLoading: false });
    }
  },
}));
