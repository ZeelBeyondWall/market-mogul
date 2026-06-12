import { useState } from 'react';

// Per-asset logo image with SVG sprite fallback. Logos live in
// /assets/logos/<ID>.webp; if one is missing the old <use href="#icon">
// glyph renders instead, so partial logo sets never break the UI.
export function AssetIcon({ id, icon, className, size }: {
  id: string;
  icon: string;             // SvgDefs sprite id (fallback)
  className?: string;
  size?: number;            // px — when set, applied to both img and svg
}) {
  const [failed, setFailed] = useState(false);
  const style = size ? { width: size, height: size } : undefined;
  if (failed) {
    return <svg className={className} style={style}><use href={`#${icon}`} /></svg>;
  }
  return (
    <img
      className={className}
      style={style}
      src={`/assets/logos/${id}.webp`}
      alt={id}
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}
