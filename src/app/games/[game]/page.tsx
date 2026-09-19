import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Gauge, Users } from "lucide-react";
import { GAMES } from "@/constants/games";
import { isPlayable } from "@/engine";
import { LinkButton } from "@/components/ui/Button";

interface Props {
  params: { game: string };
}

export function generateStaticParams() {
  return GAMES.map((g) => ({ game: g.id }));
}

/**
 * Per-game metadata. These ten pages carry real long-form copy and were already
 * statically generated via `generateStaticParams`, but had no titles,
 * descriptions or OG tags — so every one of them shared the site default.
 */
export function generateMetadata({ params }: Props): Metadata {
  const game = GAMES.find((g) => g.id === params.game);
  if (!game) return { title: "找不到遊戲" };

  const title = `${game.name} (${game.nameEn})`;
  const description = game.longDescription;
  const playable = isPlayable(game.id);

  return {
    title,
    description,
    keywords: [game.name, game.nameEn, ...game.tags],
    openGraph: {
      title,
      description,
      type: "article",
      ...(playable ? {} : { description: `${description}（即將推出）` }),
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function GameDetailPage({ params }: Props) {
  const game = GAMES.find((g) => g.id === params.game);
  if (!game) notFound();

  const playable = isPlayable(game.id);

  return (
    <main className="min-h-screen bg-ink px-4 pb-16 pt-24 text-white">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/games"
          className="mb-8 inline-flex items-center gap-2 text-sm text-white/40 transition-colors hover:text-white/70"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> 返回遊戲列表
        </Link>

        <article className="glass-card rounded-3xl p-8">
          <header className="mb-6 flex items-start gap-4">
            <span
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl text-4xl"
              style={{ background: `${game.color}20`, border: `1px solid ${game.color}30` }}
              aria-hidden="true"
            >
              {game.icon}
            </span>
            <div>
              <h1 className="mb-1 text-3xl font-bold">{game.name}</h1>
              <p lang="en" className="text-sm text-white/40">
                {game.nameEn}
              </p>
            </div>
          </header>

          <p className="mb-6 text-base leading-relaxed text-white/60">{game.longDescription}</p>

          <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { term: "分類", detail: game.category, icon: null },
              { term: "難度", detail: game.difficulty, icon: <Gauge className="h-3.5 w-3.5" aria-hidden="true" /> },
              {
                term: "人數",
                detail: `${game.minPlayers}–${game.maxPlayers} 人`,
                icon: <Users className="h-3.5 w-3.5" aria-hidden="true" />,
              },
              {
                term: "時間",
                detail: game.estimatedDuration,
                icon: <Clock className="h-3.5 w-3.5" aria-hidden="true" />,
              },
            ].map((item) => (
              <div key={item.term} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <dt className="mb-1 flex items-center gap-1 text-xs text-white/40">
                  {item.icon}
                  {item.term}
                </dt>
                <dd className="text-sm font-medium text-white/80">{item.detail}</dd>
              </div>
            ))}
          </dl>

          <div className="mb-8 flex flex-wrap gap-2">
            {game.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-white/5 bg-white/5 px-2.5 py-1 text-xs text-white/40">
                {tag}
              </span>
            ))}
          </div>

          {playable ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              <LinkButton
                href={`/create/${game.id}`}
                size="md"
                className="flex-1"
                style={{ background: game.gradient }}
              >
                建立房間
              </LinkButton>
              <LinkButton href="/join" variant="glass" size="md" className="flex-1">
                用代碼加入
              </LinkButton>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
              <p className="mb-1 text-sm font-semibold text-white/80">這款遊戲即將推出</p>
              <p className="mb-4 text-sm text-white/40">
                內容已經規劃好了，玩法引擎還在開發中。先試試已經開放的遊戲吧。
              </p>
              <LinkButton href="/games" variant="ghost" size="md">
                看看其他遊戲
              </LinkButton>
            </div>
          )}
        </article>
      </div>
    </main>
  );
}
