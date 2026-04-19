import React, { forwardRef } from "react";
import { fullPhotoUrl } from "@/lib/photo";

function fmtDistance(m) {
  if (m < 1000) return `${m}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

// Fixed-size card rendered at 1080x1620 (2:3 portrait — works for IG post & stories crop)
// Kept self-contained so html-to-image captures it reliably.
const ShareCardTemplate = forwardRef(function ShareCardTemplate(
  { picks, situation, city },
  ref
) {
  return (
    <div
      ref={ref}
      data-testid="share-card-template"
      style={{
        width: 1080,
        height: 1620,
        background:
          "radial-gradient(ellipse at 20% 0%, #1d1a14 0%, #0f0f0f 55%)",
        color: "#f5f1e8",
        fontFamily: "Instrument Sans, system-ui, sans-serif",
        padding: "72px 72px 56px 72px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative corner dot */}
      <div
        style={{
          position: "absolute",
          top: 72,
          right: 72,
          width: 14,
          height: 14,
          borderRadius: 9999,
          background: "#f5a623",
          boxShadow: "0 0 40px rgba(245,166,35,0.6)",
        }}
      />

      {/* Header */}
      <div
        style={{
          fontSize: 22,
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: "#9a9385",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 9999,
            background: "#f5a623",
            display: "inline-block",
          }}
        />
        Vibe Check
      </div>

      <div
        style={{
          fontFamily: "Unbounded, sans-serif",
          fontWeight: 800,
          fontSize: 128,
          lineHeight: 0.92,
          letterSpacing: "-0.02em",
          marginTop: 36,
        }}
      >
        Go here.
        <br />
        <span style={{ color: "#f5a623" }}>Thank us later.</span>
      </div>

      <div
        style={{
          marginTop: 32,
          fontSize: 28,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "#d8d1c2",
          display: "flex",
          alignItems: "center",
          gap: 18,
        }}
      >
        <span style={{ fontSize: 40, lineHeight: 1 }}>{situation?.emoji}</span>
        <span>{situation?.title}</span>
        {city && (
          <>
            <span style={{ opacity: 0.35 }}>·</span>
            <span style={{ color: "#f5a623" }}>{city}</span>
          </>
        )}
      </div>

      {/* Picks */}
      <div
        style={{
          marginTop: 56,
          display: "flex",
          flexDirection: "column",
          gap: 22,
          flex: 1,
        }}
      >
        {picks.slice(0, 3).map((p, i) => (
          <div
            key={p.place_id}
            style={{
              display: "flex",
              gap: 24,
              background: "#1a1a1a",
              border: "1px solid #2a2622",
              borderRadius: 28,
              padding: 22,
              alignItems: "stretch",
            }}
          >
            <div
              style={{
                width: 150,
                minWidth: 150,
                height: 150,
                borderRadius: 20,
                overflow: "hidden",
                background: "#111",
                position: "relative",
                flexShrink: 0,
              }}
            >
              {p.photo_url ? (
                <img
                  src={fullPhotoUrl(p.photo_url)}
                  alt=""
                  crossOrigin="anonymous"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : null}
              <div
                style={{
                  position: "absolute",
                  top: 10,
                  left: 10,
                  width: 40,
                  height: 40,
                  borderRadius: 9999,
                  background: "linear-gradient(180deg,#f5a623 0%,#e08b0a 100%)",
                  color: "#0f0f0f",
                  fontFamily: "Unbounded, sans-serif",
                  fontWeight: 800,
                  fontSize: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {i + 1}
              </div>
            </div>
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  fontFamily: "Unbounded, sans-serif",
                  fontWeight: 700,
                  fontSize: 34,
                  lineHeight: 1.05,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {p.name}
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 22,
                  lineHeight: 1.3,
                  color: "#d8d1c2",
                  fontStyle: "italic",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                "{p.vibe}"
              </div>
              <div
                style={{
                  marginTop: 14,
                  fontSize: 20,
                  color: "#9a9385",
                  display: "flex",
                  gap: 14,
                  alignItems: "center",
                }}
              >
                <span style={{ color: "#f5a623", fontWeight: 700 }}>
                  ★ {p.rating.toFixed(1)}
                </span>
                <span style={{ opacity: 0.35 }}>·</span>
                <span>{fmtDistance(p.distance_m)}</span>
                {p.price_level != null && (
                  <>
                    <span style={{ opacity: 0.35 }}>·</span>
                    <span>{"$".repeat(Math.max(1, Math.min(4, p.price_level)))}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: 36,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 22,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: "#595247",
        }}
      >
        <span>No scrolling. Just go.</span>
        <span style={{ color: "#f5a623" }}>vibe · check</span>
      </div>
    </div>
  );
});

export default ShareCardTemplate;
