import { useState } from "react";
import { getInstrumentIcon } from "@/lib/instrument-icons";

interface InstrumentIconProps {
  symbol: string;
  size?: number;
  className?: string;
}

/**
 * Renders a branded icon for any trading instrument:
 *  - Crypto   → coloured SVG from cryptocurrency-icons CDN (MIT)
 *  - Forex    → country flag PNG from flagcdn.com (free)
 *  - Stocks   → company logo from logo.dev (free tier)
 *  - Indices / Commodities → emoji on a coloured badge
 *
 * Falls back to a monogram badge on image load error.
 */
export function InstrumentIcon({ symbol, size = 32, className = "" }: InstrumentIconProps) {
  const [imgError, setImgError] = useState(false);
  const icon = getInstrumentIcon(symbol);

  const radius = Math.round(size * 0.28);
  const containerStyle: React.CSSProperties = {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    borderRadius: radius,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    background: icon.type === "emoji" ? icon.bg : icon.bg,
  };

  // ── Emoji badge ─────────────────────────────────────────────────────────────
  if (icon.type === "emoji") {
    return (
      <div
        style={{ ...containerStyle, fontSize: size * 0.52 }}
        className={className}
        title={symbol}
      >
        {icon.emoji}
      </div>
    );
  }

  // ── Image (crypto svg / flag / stock logo) ──────────────────────────────────
  if (imgError) {
    // Monogram fallback
    const abbr = symbol.replace("/", "").slice(0, 3).toUpperCase();
    return (
      <div
        style={{
          ...containerStyle,
          background: "#1e293b",
          fontSize: Math.max(size * 0.28, 9),
          fontWeight: 800,
          color: "#94a3b8",
          fontFamily: "monospace",
          letterSpacing: "-0.5px",
        }}
        className={className}
        title={symbol}
      >
        {abbr}
      </div>
    );
  }

  const pad = icon.pad ?? 6;

  return (
    <div style={containerStyle} className={className} title={symbol}>
      <img
        src={icon.url}
        alt={symbol}
        width={size}
        height={size}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          padding: pad,
        }}
        onError={() => setImgError(true)}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}
