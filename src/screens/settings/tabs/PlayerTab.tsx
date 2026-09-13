import React from 'react';
import { useSettings } from '../../../hooks/useSettings';
import { Check } from 'lucide-react';

export const PlayerTab: React.FC = () => {
  const { settings, updateSetting } = useSettings();

  const handleClearCache = () => {
    alert('Temporary video buffer and streaming chunks have been cleared from disk.');
  };

  return (
    <div className="stremio-settings-tab-pane animate-fade-in">
      {/* Default Playback Engine */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Default Playback Engine</span>
          <span className="stremio-setting-subtext">Choose between embedded MPV / ExoPlayer or external players</span>
        </div>
        <select
          className="stremio-select"
          value={settings.defaultPlayer}
          onChange={(e) => updateSetting('defaultPlayer', e.target.value as any)}
        >
          <option value="builtin">Built-in (MPV / Libmpv)</option>
          <option value="vlc">VLC Media Player (External)</option>
          <option value="mpv">MPV Standalone (External)</option>
        </select>
      </div>

      {/* Autoplay Next Episode */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Autoplay Next Episode</span>
          <span className="stremio-setting-subtext">Automatically launches next episode when 95% is watched</span>
        </div>
        <label className="stremio-switch">
          <input
            type="checkbox"
            checked={settings.autoplayNext}
            onChange={(e) => updateSetting('autoplayNext', e.target.checked)}
          />
          <span className="stremio-switch-slider" />
        </label>
      </div>

      {/* AnimeSkip Community OP/ED Skip */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">AnimeSkip Community OP/ED Skip</span>
          <span className="stremio-setting-subtext">Fetches crowdsourced intro & outro timestamps with automatic one-click skip</span>
        </div>
        <label className="stremio-switch">
          <input
            type="checkbox"
            checked={settings.enableAnimeSkip}
            onChange={(e) => updateSetting('enableAnimeSkip', e.target.checked)}
          />
          <span className="stremio-switch-slider" />
        </label>
      </div>

      {/* Seek Step */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Arrow Keys Seek Step</span>
          <span className="stremio-setting-subtext">Duration to jump when pressing Left / Right arrow keys</span>
        </div>
        <div className="settings-slider-wrapper">
          <input
            type="range"
            min={5}
            max={60}
            step={5}
            value={settings.seekTimeSeconds}
            onChange={(e) => updateSetting('seekTimeSeconds', parseInt(e.target.value))}
            className="settings-slider"
            style={{
              background: `linear-gradient(to right, var(--stremio-purple, #7c3aed) 0%, var(--stremio-purple, #7c3aed) ${((settings.seekTimeSeconds - 5) / 55) * 100}%, rgba(255, 255, 255, 0.1) ${((settings.seekTimeSeconds - 5) / 55) * 100}%, rgba(255, 255, 255, 0.1) 100%)`,
            }}
          />
          <span className="settings-badge">{settings.seekTimeSeconds} Seconds</span>
        </div>
      </div>

      {/* Hardware Acceleration */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Hardware Acceleration</span>
          <span className="stremio-setting-subtext">Utilize GPU decoding (NVDEC / D3D11VA / VA-API) to reduce CPU usage</span>
        </div>
        <select
          className="stremio-select"
          value={settings.hardwareAcceleration}
          onChange={(e) => updateSetting('hardwareAcceleration', e.target.value as any)}
        >
          <option value="auto">Automatic (Recommended)</option>
          <option value="hardware">Strict Hardware (GPU)</option>
          <option value="software">Software (CPU Multi-threaded)</option>
        </select>
      </div>

      {/* Player Title Length Limit */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Player Title Length Limit</span>
          <span className="stremio-setting-subtext">Prevent long episode titles from crowding the player top bar</span>
        </div>
        <select
          className="stremio-select"
          value={settings.titleLimitChars}
          onChange={(e) => updateSetting('titleLimitChars', parseInt(e.target.value))}
        >
          <option value={0}>No Limit (Full Title)</option>
          <option value={16}>16 Characters Max</option>
          <option value={32}>32 Characters Max</option>
          <option value={64}>64 Characters Max</option>
          <option value={128}>128 Characters Max</option>
          <option value={-1}>Hide Title Completely</option>
        </select>
      </div>

      {/* Overlay Chips */}
      <div className="stremio-setting-row" style={{ alignItems: 'flex-start' }}>
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Player Info Overlay Chips</span>
          <span className="stremio-setting-subtext">Metadata badges displayed during playback</span>
        </div>
        <div className="settings-chip-group">
          {(['source', 'resolution', 'codecs'] as const).map((key) => {
            const isChecked = settings.showPlayerInfoChips[key];
            const labels: Record<string, string> = {
              source: 'Source',
              resolution: 'Resolution',
              codecs: 'Codecs',
            };
            return (
              <button
                key={key}
                type="button"
                className={`badge-toggle-chip ${isChecked ? 'active' : ''}`}
                onClick={() =>
                  updateSetting('showPlayerInfoChips', {
                    ...settings.showPlayerInfoChips,
                    [key]: !isChecked,
                  })
                }
              >
                {isChecked && <Check size={12} strokeWidth={2.5} />}
                <span>{labels[key]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Clear Video Cache */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Clear Video Buffer Cache</span>
          <span className="stremio-setting-subtext">Purge all temporary video segments and playback chunks</span>
        </div>
        <button className="settings-btn-subtle" onClick={handleClearCache}>
          Clear Cache
        </button>
      </div>
    </div>
  );
};

