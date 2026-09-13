import React from 'react';
import { useSettings } from '../../../hooks/useSettings';
import { Check } from 'lucide-react';
import { LANGUAGES } from '../../../utils/subtitleHelper';

const TV_TYPES = [
  { id: 'Movie', label: 'Movies' },
  { id: 'TvSeries', label: 'TV Series' },
  { id: 'Anime', label: 'Anime' },
  { id: 'AsianDrama', label: 'Asian Dramas (K-Drama)' },
  { id: 'Cartoon', label: 'Cartoons' },
  { id: 'Documentary', label: 'Documentaries' },
  { id: 'LiveStream', label: 'Live TV Streams' },
  { id: 'Torrent', label: 'Torrent Sources' },
];

export const ProvidersTab: React.FC = () => {
  const { settings, updateSetting } = useSettings();

  const toggleTvType = (typeId: string) => {
    const current = settings.preferredMediaTypes;
    if (current.includes(typeId)) {
      if (current.length > 1) {
        updateSetting(
          'preferredMediaTypes',
          current.filter((t) => t !== typeId)
        );
      }
    } else {
      updateSetting('preferredMediaTypes', [...current, typeId]);
    }
  };

  const toggleLanguage = (langTag: string) => {
    const current = settings.providerLanguages;
    if (langTag === 'all') {
      updateSetting('providerLanguages', ['all']);
      return;
    }
    let updated = current.filter((l) => l !== 'all');
    if (updated.includes(langTag)) {
      updated = updated.filter((l) => l !== langTag);
      if (updated.length === 0) updated = ['all'];
    } else {
      updated.push(langTag);
    }
    updateSetting('providerLanguages', updated);
  };

  const toggleDubStatus = (status: 'Subbed' | 'Dubbed' | 'None') => {
    const current = settings.dubStatusFilter;
    if (current.includes(status)) {
      if (current.length > 1) {
        updateSetting(
          'dubStatusFilter',
          current.filter((s) => s !== status)
        );
      }
    } else {
      updateSetting('dubStatusFilter', [...current, status]);
    }
  };

  return (
    <div className="stremio-settings-tab-pane animate-fade-in">
      {/* Provider Languages Filter */}
      <div className="stremio-setting-row" style={{ alignItems: 'flex-start' }}>
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Active Provider Languages</span>
          <span className="stremio-setting-subtext">Filter which providers are active on your Home, Discover, and Search catalog</span>
        </div>
        <div className="settings-chip-group">
          <button
            type="button"
            className={`badge-toggle-chip ${
              settings.providerLanguages.includes('all') ? 'active' : ''
            }`}
            onClick={() => toggleLanguage('all')}
          >
            🌐 All Languages
          </button>
          {LANGUAGES.slice(0, 16).map((lang) => {
            const isSelected =
              !settings.providerLanguages.includes('all') &&
              settings.providerLanguages.includes(lang.IETF_tag);
            return (
              <button
                key={lang.IETF_tag}
                type="button"
                className={`badge-toggle-chip ${isSelected ? 'active' : ''}`}
                onClick={() => toggleLanguage(lang.IETF_tag)}
              >
                {lang.flag} {lang.languageName}
              </button>
            );
          })}
        </div>
      </div>

      {/* Preferred Media Types */}
      <div className="stremio-setting-row" style={{ alignItems: 'flex-start' }}>
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Preferred Media Categories</span>
          <span className="stremio-setting-subtext">Choose which catalog genres and media formats to display</span>
        </div>
        <div className="settings-chip-group">
          {TV_TYPES.map((type) => {
            const isSelected = settings.preferredMediaTypes.includes(type.id);
            return (
              <button
                key={type.id}
                type="button"
                className={`badge-toggle-chip ${isSelected ? 'active' : ''}`}
                onClick={() => toggleTvType(type.id)}
              >
                {isSelected && <Check size={12} strokeWidth={2.5} />}
                <span>{type.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Subbed / Dubbed Audio Filter */}
      <div className="stremio-setting-row" style={{ alignItems: 'flex-start' }}>
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Audio & Subtitle Track Preference</span>
          <span className="stremio-setting-subtext">Filter media results that offer specific language tracks</span>
        </div>
        <div className="settings-chip-group">
          {(['Subbed', 'Dubbed', 'None'] as const).map((status) => {
            const isSelected = settings.dubStatusFilter.includes(status);
            return (
              <button
                key={status}
                type="button"
                className={`badge-toggle-chip ${isSelected ? 'active' : ''}`}
                onClick={() => toggleDubStatus(status)}
              >
                {isSelected && <Check size={12} strokeWidth={2.5} />}
                <span>{status === 'None' ? 'Raw / Undefined' : status}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* NSFW Adult Content Protection */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Enable Adult / NSFW Providers</span>
          <span className="stremio-setting-subtext">Requires explicit confirmation. Keep disabled if on a shared device</span>
        </div>
        <label className="stremio-switch">
          <input
            type="checkbox"
            checked={settings.enableNsfw}
            onChange={(e) => updateSetting('enableNsfw', e.target.checked)}
          />
          <span className="stremio-switch-slider" />
        </label>
      </div>
    </div>
  );
};
