import React from 'react';
import { useSettings } from '../../../hooks/useSettings';
import { Check } from 'lucide-react';
import { ACCENT_PALETTES } from '../../../types/settings';
import { LANGUAGES } from '../../../utils/subtitleHelper';

interface ThemeDefinition {
  id: 'dark' | 'amoled' | 'dracula' | 'lavender' | 'silent_blue' | 'light';
  name: string;
  sub: string;
  palette: [string, string, string];
  accent: string;
}

const THEMES: ThemeDefinition[] = [
  {
    id: 'dark',
    name: 'Stremio Void Dark',
    sub: 'Obsidian & Night Violet (#0C0B12)',
    palette: ['#0c0b12', '#19173a', '#7c3aed'],
    accent: '#7c3aed',
  },
  {
    id: 'amoled',
    name: 'Pure AMOLED Black',
    sub: 'True 0% OLED Pitch Black (#000000)',
    palette: ['#000000', '#0a0a0e', '#3b82f6'],
    accent: '#3b82f6',
  },
  {
    id: 'dracula',
    name: 'Dracula Midnight',
    sub: 'Midnight Gothic Violet (#141228)',
    palette: ['#141228', '#282a36', '#bd93f9'],
    accent: '#bd93f9',
  },
  {
    id: 'lavender',
    name: 'Lavender Dreams',
    sub: 'Soft Glowing Amethyst (#19173A)',
    palette: ['#19173a', '#241e45', '#c084fc'],
    accent: '#c084fc',
  },
  {
    id: 'silent_blue',
    name: 'Ocean Cyan Deep',
    sub: 'Deep Abyssal Blue (#080D1A)',
    palette: ['#080d1a', '#0c1b33', '#06b6d4'],
    accent: '#06b6d4',
  },
  {
    id: 'light',
    name: 'Clean Modern Gray',
    sub: 'Neutral Charcoal Slate (#141228)',
    palette: ['#141228', '#1e1e2e', '#94a3b8'],
    accent: '#94a3b8',
  },
];

const BADGE_OPTIONS = [
  { key: 'hd', label: 'HD / 4K' },
  { key: 'dub', label: 'DUB' },
  { key: 'sub', label: 'SUB' },
  { key: 'rating', label: 'Rating' },
  { key: 'episodes', label: 'Episodes' },
] as const;

export const AppearanceTab: React.FC = () => {
  const { settings, updateSetting } = useSettings();

  const currentAccent =
    ACCENT_PALETTES.find((p) => p.name === settings.primaryAccent) || ACCENT_PALETTES[0];

  const toggleBadge = (badgeKey: (typeof BADGE_OPTIONS)[number]['key']) => {
    updateSetting('showCardBadges', {
      ...settings.showCardBadges,
      [badgeKey]: !settings.showCardBadges[badgeKey],
    });
  };

  return (
    <div className="stremio-settings-tab-pane animate-fade-in">
      {/* UI Language */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">UI Language</span>
          <span className="stremio-setting-subtext">Primary language for application interface labels</span>
        </div>
        <select
          className="stremio-select"
          value={settings.language}
          onChange={(e) => updateSetting('language', e.target.value)}
        >
          {LANGUAGES.map((l) => (
            <option key={l.IETF_tag} value={l.IETF_tag}>
              {l.languageName}
            </option>
          ))}
        </select>
      </div>

      {/* Quit on close */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Quit on close</span>
          <span className="stremio-setting-subtext">Exit process completely when window close button is clicked</span>
        </div>
        <label className="stremio-switch">
          <input
            type="checkbox"
            checked={settings.quitOnClose}
            onChange={(e) => updateSetting('quitOnClose', e.target.checked)}
          />
          <span className="stremio-switch-slider" />
        </label>
      </div>

      {/* Escape key exit full screen */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Escape key exit full screen</span>
          <span className="stremio-setting-subtext">Pressing Esc returns from full screen playback to windowed mode</span>
        </div>
        <label className="stremio-switch">
          <input
            type="checkbox"
            checked={settings.escapeExitFullscreen}
            onChange={(e) => updateSetting('escapeExitFullscreen', e.target.checked)}
          />
          <span className="stremio-switch-slider" />
        </label>
      </div>

      {/* Blur unwatched episodes image */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Blur unwatched episodes image</span>
          <span className="stremio-setting-subtext">Hides episode thumbnail spoilers until marked as watched</span>
        </div>
        <label className="stremio-switch">
          <input
            type="checkbox"
            checked={settings.blurUnwatchedThumbnails}
            onChange={(e) => updateSetting('blurUnwatchedThumbnails', e.target.checked)}
          />
          <span className="stremio-switch-slider" />
        </label>
      </div>

      {/* Enable gamepad support */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Enable gamepad support</span>
          <span className="stremio-setting-subtext">Navigate media shelves and player with Xbox / PlayStation controllers</span>
        </div>
        <label className="stremio-switch">
          <input
            type="checkbox"
            checked={settings.enableGamepadSupport}
            onChange={(e) => updateSetting('enableGamepadSupport', e.target.checked)}
          />
          <span className="stremio-switch-slider" />
        </label>
      </div>

      {/* Theme & Contrast Styles */}
      <div className="stremio-setting-row" style={{ alignItems: 'flex-start', paddingTop: '16px' }}>
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Theme & Contrast</span>
          <span className="stremio-setting-subtext">Tailored dark aesthetics for OLED & cinema monitors</span>
        </div>
        <div className="theme-options-grid">
          {THEMES.map((t) => {
            const isSelected = settings.theme === t.id;
            return (
              <div
                key={t.id}
                className={`theme-card ${isSelected ? 'active' : ''}`}
                onClick={() => updateSetting('theme', t.id)}
              >
                <div className="theme-card-left">
                  <div
                    className="theme-card-indicator"
                    style={{
                      borderColor: isSelected ? t.accent : 'rgba(255, 255, 255, 0.15)',
                      background: isSelected ? t.accent : 'transparent',
                    }}
                  >
                    {isSelected && <Check size={11} color="#ffffff" strokeWidth={3} />}
                  </div>
                  <div className="theme-card-info">
                    <span className="theme-card-name">{t.name}</span>
                    <span className="theme-card-sub">{t.sub}</span>
                  </div>
                </div>

                <div className="theme-card-preview-bar">
                  <span style={{ backgroundColor: t.palette[0] }} />
                  <span style={{ backgroundColor: t.palette[1] }} />
                  <span style={{ backgroundColor: t.palette[2] }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Primary Color Accent Palettes */}
      <div className="stremio-setting-row" style={{ alignItems: 'flex-start', paddingTop: '16px' }}>
        <div className="stremio-setting-label-col">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="stremio-setting-label">Accent Color</span>
            <span
              className="accent-active-pill"
              style={{
                backgroundColor: `${currentAccent.hex}22`,
                borderColor: `${currentAccent.hex}55`,
                color: currentAccent.hex,
              }}
            >
              <span
                className="accent-active-dot"
                style={{ backgroundColor: currentAccent.hex }}
              />
              {settings.primaryAccent}
            </span>
          </div>
          <span className="stremio-setting-subtext">System highlights, focus rings, and action states</span>
        </div>
        <div className="accent-palette-grid">
          {ACCENT_PALETTES.map((palette) => {
            const isSelected = settings.primaryAccent === palette.name;
            return (
              <button
                key={palette.name}
                type="button"
                className={`accent-palette-btn ${isSelected ? 'active' : ''}`}
                style={{
                  backgroundColor: palette.hex,
                  boxShadow: isSelected
                    ? `0 0 0 2px #0c0b12, 0 0 0 4px ${palette.hex}, 0 4px 14px ${palette.glow}`
                    : 'none',
                }}
                onClick={() => updateSetting('primaryAccent', palette.name)}
                title={`${palette.name} (${palette.hex})`}
              >
                {isSelected && <Check size={14} color="#ffffff" strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Catalog & Poster Card Sizing */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Poster Card Scale</span>
          <span className="stremio-setting-subtext">Adjust poster density on shelves and catalog grid</span>
        </div>
        <div className="settings-slider-wrapper">
          <input
            type="range"
            min={0}
            max={15}
            step={1}
            value={settings.posterScale}
            onChange={(e) => updateSetting('posterScale', parseInt(e.target.value))}
            className="settings-slider"
            style={{
              background: `linear-gradient(to right, var(--stremio-purple, #7c3aed) 0%, var(--stremio-purple, #7c3aed) ${(settings.posterScale / 15) * 100}%, rgba(255, 255, 255, 0.1) ${(settings.posterScale / 15) * 100}%, rgba(255, 255, 255, 0.1) 100%)`,
            }}
          />
          <span className="settings-badge">Level {settings.posterScale} of 15</span>
        </div>
      </div>

      {/* Title Placement */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Show full title below poster</span>
          <span className="stremio-setting-subtext">Display complete media name underneath thumbnail artwork</span>
        </div>
        <label className="stremio-switch">
          <input
            type="checkbox"
            checked={settings.bottomTitles}
            onChange={(e) => updateSetting('bottomTitles', e.target.checked)}
          />
          <span className="stremio-switch-slider" />
        </label>
      </div>

      {/* Media Card Badges */}
      <div className="stremio-setting-row" style={{ alignItems: 'flex-start' }}>
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Media Card Badges</span>
          <span className="stremio-setting-subtext">Information chips displayed over poster art</span>
        </div>
        <div className="settings-chip-group">
          {BADGE_OPTIONS.map((badge) => {
            const isChecked = settings.showCardBadges[badge.key];
            return (
              <button
                key={badge.key}
                type="button"
                className={`badge-toggle-chip ${isChecked ? 'active' : ''}`}
                onClick={() => toggleBadge(badge.key)}
              >
                {isChecked && <Check size={12} strokeWidth={2.5} />}
                <span>{badge.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Advanced Multi-Provider Search */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Advanced Multi-Provider Search</span>
          <span className="stremio-setting-subtext">Query all active extensions simultaneously</span>
        </div>
        <label className="stremio-switch">
          <input
            type="checkbox"
            checked={settings.advancedSearch}
            onChange={(e) => updateSetting('advancedSearch', e.target.checked)}
          />
          <span className="stremio-switch-slider" />
        </label>
      </div>

      {/* Search Auto-Complete Suggestions */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Search Auto-Complete Suggestions</span>
          <span className="stremio-setting-subtext">Instant dropdown match while typing queries</span>
        </div>
        <label className="stremio-switch">
          <input
            type="checkbox"
            checked={settings.searchSuggestions}
            onChange={(e) => updateSetting('searchSuggestions', e.target.checked)}
          />
          <span className="stremio-switch-slider" />
        </label>
      </div>

      {/* Show YouTube Trailers */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Show YouTube trailers in details</span>
          <span className="stremio-setting-subtext">Embed official trailer previews inside media detail modal</span>
        </div>
        <label className="stremio-switch">
          <input
            type="checkbox"
            checked={settings.showTrailers}
            onChange={(e) => updateSetting('showTrailers', e.target.checked)}
          />
          <span className="stremio-switch-slider" />
        </label>
      </div>

      {/* Show Cast & Characters */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Show cast & crew in details</span>
          <span className="stremio-setting-subtext">Display actor photos, character names, and director bios</span>
        </div>
        <label className="stremio-switch">
          <input
            type="checkbox"
            checked={settings.showCast}
            onChange={(e) => updateSetting('showCast', e.target.checked)}
          />
          <span className="stremio-switch-slider" />
        </label>
      </div>

      {/* Highlight Anime Filler Episodes */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Highlight anime filler episodes</span>
          <span className="stremio-setting-subtext">Tag non-canon filler anime episodes with an orange indicator</span>
        </div>
        <label className="stremio-switch">
          <input
            type="checkbox"
            checked={settings.showFillers}
            onChange={(e) => updateSetting('showFillers', e.target.checked)}
          />
          <span className="stremio-switch-slider" />
        </label>
      </div>
    </div>
  );
};

