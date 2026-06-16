import { isUserType } from "@/types/user";
import type { UserType } from "@/types/user";

const SESSION_KEY = "apartmentrenos.authSession";

export type AuthSession = {
  userId: string;
  username: string;
  type: UserType;
};

function readRaw(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    const userId = typeof parsed.userId === "string" ? parsed.userId.trim() : "";
    const username = typeof parsed.username === "string" ? parsed.username.trim() : "";
    const type = isUserType(parsed.type) ? parsed.type : null;
    if (!userId || !username || !type) return null;
    return { userId, username, type };
  } catch {
    return null;
  }
}

export function getAuthSession(): AuthSession | null {
  return readRaw();
}

export function isLoggedIn(): boolean {
  return getAuthSession() != null;
}

export function setAuthSession(session: AuthSession | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!session) {
      window.localStorage.removeItem(SESSION_KEY);
      return;
    }
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

export function clearAuthSession(): void {
  setAuthSession(null);
}
