import React, { useState } from 'react';
import { Film, Clapperboard, Tv, Play, Disc, Radio, Sparkles } from 'lucide-react';

interface ProviderIconProps {
  name: string;
  iconUrl?: string;
  size?: number;
}

// Built-in theme presets for popular CloudStream & BDIX providers
const KNOWN_PROVIDER_STYLES: Record<
  string,
  { bg: string; color: string; icon: React.ComponentType<{ size?: number; color?: string }> }
> = {
  circle: {
    bg: 'linear-gradient(135deg, #f59e0b, #d97706)',
    color: '#ffffff',
    icon: Disc,
  },
  cineplex: {
    bg: 'linear-gradient(135deg, #ef4444, #dc2626)',
    color: '#ffffff',
    icon: Film,
  },
  dhakaflix: {
    bg: 'linear-gradient(135deg, #06b6d4, #0284c7)',
    color: '#ffffff',
    icon: Radio,
  },
  discovery: {
    bg: 'linear-gradient(135deg, #64748b, #475569)',
    color: '#ffffff',
    icon: Clapperboard,
  },
  moviebox: {
    bg: 'linear-gradient(135deg, #10b981, #059669)',
    color: '#ffffff',
    icon: Play,
  },
  allwish: {
    bg: 'linear-gradient(135deg, #ec4899, #db2777)',
    color: '#ffffff',
    icon: Sparkles,
  },
  aniwatch: {
    bg: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
    color: '#ffffff',
    icon: Sparkles,
  },
  samonline: {
    bg: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    color: '#ffffff',
    icon: Tv,
  },
};

function getProviderTheme(name: string) {
  const lower = name.toLowerCase();
  for (const [key, theme] of Object.entries(KNOWN_PROVIDER_STYLES)) {
    if (lower.includes(key)) {
      return theme;
    }
  }

  // Consistent deterministic gradient based on name hash
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return {
    bg: `linear-gradient(135deg, hsl(${hue}, 70%, 55%), hsl(${(hue + 40) % 360}, 75%, 45%))`,
    color: '#ffffff',
    icon: null,
  };
}

export const ProviderIcon: React.FC<ProviderIconProps> = ({ name, iconUrl, size = 22 }) => {
  const [imgError, setImgError] = useState(false);
  const theme = getProviderTheme(name);
  const IconComp = theme.icon;

  if (iconUrl && !imgError) {
    return (
      <img
        src={iconUrl}
        alt={name}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '5px',
          objectFit: 'contain',
          background: 'rgba(255, 255, 255, 0.04)',
          flexShrink: 0,
          border: 'none',
        }}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '5px',
        background: theme.bg,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: theme.color,
        fontSize: `${Math.max(10, Math.round(size * 0.48))}px`,
        fontWeight: 800,
        flexShrink: 0,
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)',
      }}
      title={name}
    >
      {IconComp ? (
        <IconComp size={Math.round(size * 0.58)} color="#ffffff" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  );
};
