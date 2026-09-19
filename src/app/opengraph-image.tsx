import { ImageResponse } from "next/og";

export const alt = "PARTYVERSE — One Room. Ten Games. Infinite Chaos.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Static OG image. English only on purpose: `ImageResponse` ships with a Latin
 * font, so Traditional Chinese would render as empty boxes unless a CJK font
 * file is passed in `fonts`.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#050508",
          backgroundImage: "radial-gradient(circle at 30% 20%, rgba(168,85,247,0.35), transparent 55%), radial-gradient(circle at 75% 80%, rgba(255,45,149,0.28), transparent 55%)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 96, fontWeight: 700, letterSpacing: -2 }}>
          <span style={{ display: "flex" }}>PARTY</span>
          <span
            style={{
              display: "flex",
              backgroundImage: "linear-gradient(90deg, #a855f7, #ff2d95, #00f0ff)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            VERSE
          </span>
        </div>
        <div style={{ display: "flex", marginTop: 24, fontSize: 30, color: "rgba(255,255,255,0.6)" }}>
          One Room. Ten Games. Infinite Chaos.
        </div>
      </div>
    ),
    size,
  );
}
