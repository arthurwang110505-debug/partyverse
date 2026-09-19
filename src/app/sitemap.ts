import type { MetadataRoute } from "next";
import { GAMES } from "@/constants/games";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: siteUrl, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/games`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/join`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    ...GAMES.map((game) => ({
      url: `${siteUrl}/games/${game.id}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
