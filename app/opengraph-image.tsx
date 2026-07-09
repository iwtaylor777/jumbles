import { ImageResponse } from "next/og";

export const alt = "Jumbles — the daily word game";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TILES = [
  { ch: "J", gold: true },
  { ch: "U", gold: false },
  { ch: "M", gold: false },
  { ch: "B", gold: true },
  { ch: "L", gold: false },
  { ch: "E", gold: false },
  { ch: "S", gold: true },
];

export default function OG() {
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
          background: "#f6f3ec",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            fontSize: 26,
            letterSpacing: 8,
            fontWeight: 700,
            color: "#b9791a",
            textTransform: "uppercase",
          }}
        >
          The Daily Word Game
        </div>
        <div style={{ fontSize: 132, fontWeight: 700, color: "#1c1b18", marginTop: 6 }}>
          Jumbles
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 34 }}>
          {TILES.map((t, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 96,
                height: 96,
                borderRadius: 18,
                fontSize: 54,
                fontWeight: 700,
                background: t.gold ? "#e0a63a" : "#fffdf8",
                color: t.gold ? "#241a05" : "#1c1b18",
                border: t.gold ? "3px solid #e0a63a" : "3px solid #ccc4b4",
              }}
            >
              {t.ch}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 34, color: "#7a746b", marginTop: 40 }}>
          Unscramble the words. Crack the bonus.
        </div>
      </div>
    ),
    { ...size },
  );
}
