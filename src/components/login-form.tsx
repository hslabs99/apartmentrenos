"use client";

import {
  DEFAULT_DEV_PASSWORD,
  DEFAULT_DEV_USERNAME,
} from "@/lib/auth-defaults";
import { setAuthSession } from "@/lib/client/auth-session";
import { sfPrimaryToolbarButton, sfSectionLead } from "@/lib/sf-layout";
import type { UserType } from "@/types/user";
import { useRouter } from "next/navigation";
import { useState } from "react";

const inputClass =
  "min-h-11 w-full rounded-lg border border-sf-border-strong bg-sf-surface px-3 py-2 text-base text-sf-text outline-none focus:border-sf-brand focus:ring-2 focus:ring-sf-brand/20 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState(DEFAULT_DEV_USERNAME);
  const [password, setPassword] = useState(DEFAULT_DEV_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json()) as {
        user?: { id: string; username: string; type: UserType };
        error?: string;
      };
      if (!res.ok || !data.user) {
        throw new Error(data.error ?? "Login failed");
      }
      setAuthSession({
        userId: data.user.id,
        username: data.user.username,
        type: data.user.type,
      });
      router.replace("/projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-lg border border-sf-border bg-sf-surface p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-6 space-y-1">
          <h1 className="text-xl font-normal tracking-tight text-sf-text dark:text-zinc-50">
            Sign in
          </h1>
          <p className={sfSectionLead}>
            Use your staff account from Users. Default credentials are pre-filled for quick access.
          </p>
        </div>

        <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
              Username
            </span>
            <input
              type="text"
              name="username"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputClass}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
              Password
            </span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </label>

          {error ? (
            <div
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className={`${sfPrimaryToolbarButton} min-h-11 w-full disabled:opacity-50`}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
