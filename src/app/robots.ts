import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Live rooms and the room-creation flow are private, per-session pages.
      disallow: ["/room/", "/create/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
