import React from 'react';

/**
 * Hexagonal level shield — the HUD identity emblem.
 * Stroke color follows `color` prop (defaults to neon cyan).
 */
export function LevelShield({
  level,
  size = 44,
  color = 'var(--neon-cyan)',
  glow = true,
}: {
  level: number;
  size?: number;
  color?: string;
  glow?: boolean;
}) {
  const h = size * (48 / 44);
  const fontSize = level >= 100 ? 12 : level >= 10 ? 15 : 17;
  return (
    <svg
      width={size}
      height={h}
      viewBox="0 0 44 48"
      role="img"
      aria-label={`Level ${level}`}
      style={glow ? { filter: `drop-shadow(0 0 6px ${color})` } : undefined}
    >
      <polygon
        points="22,2 41,13 41,35 22,46 3,35 3,13"
        fill="var(--hud-panel, #0c1120)"
        stroke={color}
        strokeWidth="2"
      />
      <polygon points="22,7 37,15.5 37,32.5 22,41 7,32.5 7,15.5" fill="var(--hud-raise, #11203a)" />
      <text
        x="22"
        y="22"
        dominantBaseline="central"
        textAnchor="middle"
        fill={color}
        style={{ fontFamily: 'var(--font-display)', fontSize }}
      >
        {level}
      </text>
    </svg>
  );
}
