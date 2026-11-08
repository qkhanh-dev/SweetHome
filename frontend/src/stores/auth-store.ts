"use client";

import { create } from "zustand";
import { ApiError } from "@/services/apiError";
import { apiClient, getAccessToken, setAccessToken } from "@/services/apiClient";
import type { TaiKhoan } from "@/types/sweethome";

export type AuthStatus = "unknown" | "loading" | "authenticated" | "loggingOut" | "anonymous" | "error";

interface AuthState {
  user: TaiKhoan | null;
  token: string | null;
  status: AuthStatus;
  error: string | null;
  setSession: (user: TaiKhoan, token: string) => void;
  restore: () => Promise<void>;
  clearSession: () => void;
  beginLogout: () => void;
}

let restoreRequest: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  status: "unknown",
  error: null,
  setSession: (user, token) => {
    setAccessToken(token);
    set({ user, token, status: "authenticated", error: null });
  },
  restore: async () => {
    const status = get().status;
    if (status === "authenticated") return;
    if (restoreRequest) return restoreRequest;

    restoreRequest = (async () => {
      set({ status: "loading", error: null });
      try {
        const response = await apiClient.getMe();
        const token = getAccessToken();
        if (!token) throw new ApiError("Không khôi phục được token của phiên đã xác minh.", 401, null);
        set({ user: response.data, token, status: "authenticated", error: null });
      } catch (error) {
        setAccessToken(null);
        if (error instanceof ApiError && (error.statusCode === 401 || error.statusCode === 403)) {
          set({ user: null, token: null, status: "anonymous", error: error.message });
        } else {
          set({ user: null, token: null, status: "error", error: error instanceof Error ? error.message : "Không thể khôi phục phiên." });
        }
      } finally {
        restoreRequest = null;
      }
    })();
    return restoreRequest;
  },
  clearSession: () => {
    setAccessToken(null);
    set({ user: null, token: null, status: "anonymous", error: null });
  },
  beginLogout: () => {
    setAccessToken(null);
    set({ token: null, status: "loggingOut", error: null });
  },
}));
