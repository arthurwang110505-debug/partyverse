import Link from "next/link";

/**
 * Replaces Next's stock white-background 404, which flashed a light page on a
 * site whose entire palette is `#050508`.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-ink px-4 text-center text-white">
      <p className="mb-4 text-6xl" aria-hidden="true">
        🕹️
      </p>
      <h1 className="mb-2 text-3xl font-bold">找不到這個頁面</h1>
      <p lang="en" className="mb-8 max-w-sm text-white/50">
        This page could not be found. The room may have ended, or the link may be wrong.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-white/90"
        >
          回到首頁
        </Link>
        <Link
          href="/games"
          className="glass rounded-xl px-5 py-2.5 text-sm font-semibold text-white/80 transition-colors hover:text-white"
        >
          瀏覽遊戲
        </Link>
      </div>
    </main>
  );
}
