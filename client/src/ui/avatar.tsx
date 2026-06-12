// Level-based avatar art (replaces the old emoji ladder 🧑‍🚀→👑).
// Thresholds mirror the original emoji mapping exactly.
export function avatarSrc(level: number): string {
  const tier =
    level < 5 ? 1 :
    level < 10 ? 5 :
    level < 20 ? 10 :
    level < 30 ? 20 :
    level < 50 ? 30 : 50;
  return `/assets/avatars/avatar_lvl${tier}.webp`;
}

export function AvatarImg({ level, size, className }: { level: number; size?: number; className?: string }) {
  return (
    <img
      src={avatarSrc(level)}
      alt={`Level ${level} avatar`}
      className={className}
      loading="lazy"
      draggable={false}
      style={{ width: size ?? '100%', height: size ?? '100%', borderRadius: '50%', objectFit: 'cover', display: 'block' }}
    />
  );
}
