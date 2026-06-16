import { getAuthSession } from "@/lib/client/auth-session";

const STORAGE_KEY = "apartmentrenos.currentUsername";

/** Best-effort logged-in username (localStorage); set when user signs in. */
export function getCurrentUsername(): string {
  const session = getAuthSession();
  if (session?.username) return session.username;
  if (typeof window === "undefined") return "";
  try {
    return (localStorage.getItem(STORAGE_KEY) ?? "").trim();
  } catch {
    return "";
  }
}

export function setCurrentUsername(username: string): void {
  if (typeof window === "undefined") return;
  try {
    const t = username.trim();
    if (t) localStorage.setItem(STORAGE_KEY, t);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
