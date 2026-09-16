import { notFound } from "next/navigation";
import { GAMES } from "@/constants/games";

interface Props {
  params: { game: string };
}

export function generateStaticParams() {
  return GAMES.map((g) => ({ game: g.id }));
}

export default function GameDetailPage({ params }: Props) {
  const game = GAMES.find((g) => g.id === params.game);
  if (!game) notFound();

  return (
    <div className="min-h-screen bg-[#050508] text-white pt-24 pb-16 px-4">
      <div className="max-w-3xl mx-auto">
        <a href="/games" className="inline-flex items-center gap-2 text-white/40 hover:text-white/70 mb-8 transition-colors text-sm">
          ← Back to Games
        </a>

        <div className="glass-card rounded-3xl p-8">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl" style={{ background: `${game.color}20`, border: `1px solid ${game.color}30` }}>
              {game.icon}
            </div>
            <div>
              <h1 className="font-bold text-3xl mb-1">{game.name}</h1>
              <p className="text-white/40 text-sm">{game.nameEn}</p>
            </div>
          </div>

          <p className="text-white/60 text-base leading-relaxed mb-6">{game.longDescription}</p>

          <div className="flex flex-wrap gap-2 mb-6">
            <span className="px-3 py-1.5 rounded-full bg-white/5 text-sm text-white/60 border border-white/10">{game.category}</span>
            <span className="px-3 py-1.5 rounded-full bg-white/5 text-sm text-white/60 border border-white/10">{game.difficulty}</span>
            <span className="px-3 py-1.5 rounded-full bg-white/5 text-sm text-white/60 border border-white/10">{game.minPlayers}–{game.maxPlayers} players</span>
            <span className="px-3 py-1.5 rounded-full bg-white/5 text-sm text-white/60 border border-white/10">{game.estimatedDuration}</span>
          </div>

          <div className="flex flex-wrap gap-2 mb-8">
            {game.tags.map((tag) => (
              <span key={tag} className="px-2.5 py-1 rounded-full bg-white/5 text-white/40 text-xs border border-white/5">{tag}</span>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <a href={`/create/${game.id}`} className="flex-1 py-3.5 rounded-xl font-semibold text-sm text-center transition-all hover:opacity-90" style={{ background: game.gradient }}>
              Create Room
            </a>
            <a href="/games" className="flex-1 py-3.5 rounded-xl font-semibold text-sm text-center glass hover:bg-white/10 transition-all">
              Back to Games
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
