import React, { useState } from 'react';
import { useSettings } from '../../../hooks/useSettings';
import { Check } from 'lucide-react';
import { LANGUAGES } from '../../../utils/subtitleHelper';

export const SubtitlesTab: React.FC = () => {
  const { settings, updateSubtitleStyle } = useSettings();
  const sub = settings.subtitles;
  const [sampleText, setSampleText] = useState(
    'CloudStream Desktop — Seamless Anime & Movie Playback'
  );

  return (
    <div className="stremio-settings-tab-pane animate-fade-in">
      {/* Interactive Subtitle Live Preview Box */}
      <div style={{ marginBottom: '24px' }}>
        <div className="subtitle-preview-screen">
          <div className="subtitle-preview-backdrop" />
          <div
            className={`subtitle-preview-box-container alignment-${sub.alignment}`}
            style={{ paddingBottom: `${sub.elevation}px` }}
          >
            <div
              className="subtitle-text-element"
              style={{
                color: sub.foregroundColor,
                backgroundColor: sub.backgroundColor,
                fontFamily: sub.fontFamily,
                fontSize: `${sub.fontSize}px`,
                borderRadius: `${sub.backgroundRadius}px`,
                fontWeight: sub.bold ? 'bold' : 'normal',
                fontStyle: sub.italic ? 'italic' : 'normal',
                textTransform: sub.upperCase ? 'uppercase' : 'none',
                textShadow:
                  sub.edgeType === 'outline'
                    ? `-${sub.edgeSize}px -${sub.edgeSize}px 0 ${sub.edgeColor}, ${sub.edgeSize}px -${sub.edgeSize}px 0 ${sub.edgeColor}, -${sub.edgeSize}px ${sub.edgeSize}px 0 ${sub.edgeColor}, ${sub.edgeSize}px ${sub.edgeSize}px 0 ${sub.edgeColor}`
                    : sub.edgeType === 'drop_shadow'
                    ? `2px 3px 4px ${sub.edgeColor}`
                    : 'none',
              }}
            >
              {sampleText}
            </div>
          </div>
        </div>

        <div style={{ marginTop: '10px' }}>
          <input
            type="text"
            className="settings-text-input"
            value={sampleText}
            onChange={(e) => setSampleText(e.target.value)}
            placeholder="Type custom test phrase..."
          />
        </div>
      </div>

      {/* Font Family */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Font Family</span>
          <span className="stremio-setting-subtext">Select typeface for on-screen subtitle rendering</span>
        </div>
        <select
          className="stremio-select"
          value={sub.fontFamily}
          onChange={(e) => updateSubtitleStyle('fontFamily', e.target.value)}
        >
          <option value="Inter">Inter</option>
          <option value="Outfit">Outfit</option>
          <option value="'Roboto', sans-serif">Roboto</option>
          <option value="'Segoe UI', sans-serif">Segoe UI</option>
          <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
          <option value="Arial, sans-serif">Arial</option>
          <option value="monospace">Monospace</option>
        </select>
      </div>

      {/* Font Size */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Font Size</span>
          <span className="stremio-setting-subtext">Scale text size on your display</span>
        </div>
        <div className="settings-slider-wrapper">
          <input
            type="range"
            min={14}
            max={44}
            step={1}
            value={sub.fontSize}
            onChange={(e) => updateSubtitleStyle('fontSize', parseInt(e.target.value))}
            className="settings-slider"
            style={{
              background: `linear-gradient(to right, var(--stremio-purple, #7c3aed) 0%, var(--stremio-purple, #7c3aed) ${((sub.fontSize - 14) / 30) * 100}%, rgba(255, 255, 255, 0.1) ${((sub.fontSize - 14) / 30) * 100}%, rgba(255, 255, 255, 0.1) 100%)`,
            }}
          />
          <span className="settings-badge">{sub.fontSize} px</span>
        </div>
      </div>

      {/* Bottom Elevation */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Bottom Elevation</span>
          <span className="stremio-setting-subtext">Distance from the bottom edge of the player</span>
        </div>
        <div className="settings-slider-wrapper">
          <input
            type="range"
            min={8}
            max={80}
            step={2}
            value={sub.elevation}
            onChange={(e) => updateSubtitleStyle('elevation', parseInt(e.target.value))}
            className="settings-slider"
            style={{
              background: `linear-gradient(to right, var(--stremio-purple, #7c3aed) 0%, var(--stremio-purple, #7c3aed) ${((sub.elevation - 8) / 72) * 100}%, rgba(255, 255, 255, 0.1) ${((sub.elevation - 8) / 72) * 100}%, rgba(255, 255, 255, 0.1) 100%)`,
            }}
          />
          <span className="settings-badge">{sub.elevation} px</span>
        </div>
      </div>

      {/* Text Color */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Text Color</span>
          <span className="stremio-setting-subtext">Foreground subtitle font color</span>
        </div>
        <div className="color-picker-input-group">
          <input
            type="color"
            value={sub.foregroundColor.startsWith('#') ? sub.foregroundColor : '#FFFFFF'}
            onChange={(e) => updateSubtitleStyle('foregroundColor', e.target.value)}
            className="settings-color-swatch"
          />
          <span className="color-hex-label">{sub.foregroundColor}</span>
        </div>
      </div>

      {/* Background Box Opacity */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Background Box</span>
          <span className="stremio-setting-subtext">Shading box behind subtitle text</span>
        </div>
        <select
          className="stremio-select"
          value={sub.backgroundColor}
          onChange={(e) => updateSubtitleStyle('backgroundColor', e.target.value)}
        >
          <option value="rgba(0, 0, 0, 0.75)">Semi-transparent Black (75%)</option>
          <option value="rgba(0, 0, 0, 0.9)">Dark Black (90%)</option>
          <option value="rgba(0, 0, 0, 0.45)">Subtle Translucent (45%)</option>
          <option value="#000000">Solid Black (100%)</option>
          <option value="transparent">None (Transparent)</option>
        </select>
      </div>

      {/* Edge Treatment */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Edge Contrast</span>
          <span className="stremio-setting-subtext">Outline stroke or shadow around letters</span>
        </div>
        <select
          className="stremio-select"
          value={sub.edgeType}
          onChange={(e) => updateSubtitleStyle('edgeType', e.target.value as any)}
        >
          <option value="outline">High Contrast Outline</option>
          <option value="drop_shadow">Soft Drop Shadow</option>
          <option value="none">None (Clean Flat)</option>
        </select>
      </div>

      {/* Style Modifiers */}
      <div className="stremio-setting-row" style={{ alignItems: 'flex-start' }}>
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Style Modifiers</span>
          <span className="stremio-setting-subtext">Bold, Italic, and All-Caps formatting</span>
        </div>
        <div className="settings-chip-group">
          <button
            type="button"
            className={`badge-toggle-chip ${sub.bold ? 'active' : ''}`}
            onClick={() => updateSubtitleStyle('bold', !sub.bold)}
          >
            {sub.bold && <Check size={12} strokeWidth={2.5} />}
            <span>Bold</span>
          </button>
          <button
            type="button"
            className={`badge-toggle-chip ${sub.italic ? 'active' : ''}`}
            onClick={() => updateSubtitleStyle('italic', !sub.italic)}
          >
            {sub.italic && <Check size={12} strokeWidth={2.5} />}
            <span>Italic</span>
          </button>
          <button
            type="button"
            className={`badge-toggle-chip ${sub.upperCase ? 'active' : ''}`}
            onClick={() => updateSubtitleStyle('upperCase', !sub.upperCase)}
          >
            {sub.upperCase && <Check size={12} strokeWidth={2.5} />}
            <span>ALL CAPS</span>
          </button>
        </div>
      </div>

      {/* Hearing Impaired Tag Cleaner */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Clean Hearing Impaired (CC) Tags</span>
          <span className="stremio-setting-subtext">Automatically strips noise cues like [Applause] or (Music)</span>
        </div>
        <label className="stremio-switch">
          <input
            type="checkbox"
            checked={sub.removeCaptions}
            onChange={(e) => updateSubtitleStyle('removeCaptions', e.target.checked)}
          />
          <span className="stremio-switch-slider" />
        </label>
      </div>

      {/* Auto-Select Language */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Default Subtitle Language</span>
          <span className="stremio-setting-subtext">Automatically loads matching subtitle track on video start</span>
        </div>
        <select
          className="stremio-select"
          value={sub.autoSelectLanguage}
          onChange={(e) => updateSubtitleStyle('autoSelectLanguage', e.target.value)}
        >
          {LANGUAGES.map((l) => (
            <option key={l.IETF_tag} value={l.IETF_tag}>
              {l.languageName}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

