import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: "#1a2e1a",
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            color: "#C9A84C",
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "-0.5px",
            fontFamily: "sans-serif",
          }}
        >
          WT
        </span>
      </div>
    ),
    { ...size }
  );
}
