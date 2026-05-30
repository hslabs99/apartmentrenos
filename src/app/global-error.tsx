"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
          <h1 className="text-lg font-semibold text-sf-text dark:text-zinc-100">
            Something went wrong
          </h1>
          <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
            {error.digest ? `Reference: ${error.digest}` : error.message}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="w-fit rounded-lg bg-sf-brand px-4 py-2 text-sm font-medium text-white"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
