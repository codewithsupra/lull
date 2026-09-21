import { ImageResponse } from "next/og";

export const alt = "Lull — Calm, composed for you";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
          background: "radial-gradient(ellipse at 50% 20%, #1b2a66 0%, #03050b 65%)",
          color: "#e8edf7",
        }}
      >
        <div
          style={{
            fontSize: 260,
            fontWeight: 900,
            fontStyle: "italic",
            letterSpacing: -12,
            lineHeight: 1,
            backgroundImage: "linear-gradient(180deg, #d9fff3, #8ef5d4 35%, #6aa6ff 70%, #3b5bff)",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          lull
        </div>
        <div style={{ fontSize: 52, fontWeight: 700, marginTop: 10 }}>Calm, composed for you.</div>
        <div style={{ fontSize: 26, color: "#8b95aa", marginTop: 18 }}>
          AI-composed meditations · generative soundscapes · guided breathwork
        </div>
      </div>
    ),
    size,
  );
}
