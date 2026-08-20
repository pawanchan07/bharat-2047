'use client';

/**
 * The tricolour, drawn rather than typed.
 *
 * The 🇮🇳 emoji is a regional-indicator pair, which Windows renders as the bare letters
 * "IN", the wrong first impression for a project about India. This SVG is identical on
 * every platform, chakra and all.
 */

import React from 'react';

const SPOKES = Array.from({ length: 24 }, (_, i) => (i * 360) / 24);

export function Tricolour({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 90 60" className={className} role="img" aria-label="Flag of India">
      <rect width="90" height="20" fill="#FF9933" />
      <rect y="20" width="90" height="20" fill="#FFFFFF" />
      <rect y="40" width="90" height="20" fill="#138808" />
      <g transform="translate(45 30)" stroke="#000088" fill="none">
        <circle r="8.4" strokeWidth="1.1" />
        <circle r="1.5" fill="#000088" stroke="none" />
        {SPOKES.map((deg) => (
          <line key={deg} x1="0" y1="0" x2="0" y2="-8.4" strokeWidth="0.5" transform={`rotate(${deg})`} />
        ))}
      </g>
      <rect width="90" height="60" fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="0.8" />
    </svg>
  );
}
