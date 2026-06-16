"use client";

import { LoginForm } from "@/components/login-form";
import { isLoggedIn } from "@/lib/client/auth-session";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isLoggedIn()) return;
    const next = searchParams.get("next");
    router.replace(next?.startsWith("/") ? next : "/projects");
  }, [router, searchParams]);

  if (isLoggedIn()) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center text-sm text-sf-text-weak dark:text-zinc-400">
        Redirecting…
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-sf-page px-4 py-8 dark:bg-zinc-950">
      <div className="mb-8 text-center">
        <div className="text-[0.6875rem] font-normal uppercase tracking-wider text-sf-text-weak dark:text-zinc-400">
          App
        </div>
        <div className="mt-0.5 text-2xl font-normal tracking-tight text-sf-text dark:text-zinc-50">
          Apartment renos
        </div>
      </div>
      <LoginForm />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center text-sm text-sf-text-weak dark:text-zinc-400">
          Loading…
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
