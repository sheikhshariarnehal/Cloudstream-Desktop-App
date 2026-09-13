import React, { useState } from 'react';
import { useSettings } from '../../../hooks/useSettings';
import { Plus, Trash2 } from 'lucide-react';

export const GeneralTab: React.FC = () => {
  const { settings, updateSetting, addCustomSite, removeCustomSite } = useSettings();
  const [showAddSiteModal, setShowAddSiteModal] = useState(false);
  const [siteName, setSiteName] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [siteLang, setSiteLang] = useState('en');
  const [siteClass, setSiteClass] = useState('SuperStream');
  const [showEasterEgg, setShowEasterEgg] = useState(false);

  const handleAddSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteName.trim() || !siteUrl.trim()) return;
    addCustomSite({
      name: siteName.trim(),
      url: siteUrl.trim(),
      lang: siteLang.trim(),
      parentClassName: siteClass.trim(),
    });
    setSiteName('');
    setSiteUrl('');
    setShowAddSiteModal(false);
  };

  const handleBeneneClick = () => {
    const next = settings.beneneCount + 1;
    updateSetting('beneneCount', next);
    if (next % 20 === 0) {
      setShowEasterEgg(true);
      setTimeout(() => setShowEasterEgg(false), 5000);
    }
  };

  return (
    <div className="stremio-settings-tab-pane animate-fade-in">
      {/* Storage Directory */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Storage Directory</span>
          <span className="stremio-setting-subtext">Where offline videos and series will be saved</span>
        </div>
        <div className="settings-input-group" style={{ maxWidth: '320px', width: '100%' }}>
          <input
            type="text"
            className="settings-text-input"
            value={settings.downloadPath}
            onChange={(e) => updateSetting('downloadPath', e.target.value)}
          />
        </div>
      </div>

      {/* Parallel Episode Downloads */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Parallel Episode Downloads</span>
          <span className="stremio-setting-subtext">Simultaneous downloads in queue</span>
        </div>
        <div className="settings-slider-wrapper">
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={settings.parallelDownloads}
            onChange={(e) => updateSetting('parallelDownloads', parseInt(e.target.value))}
            className="settings-slider"
          />
          <span className="settings-badge">{settings.parallelDownloads} Active</span>
        </div>
      </div>

      {/* Custom Site Overrides */}
      <div className="stremio-setting-row" style={{ alignItems: 'flex-start', paddingTop: '16px' }}>
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Custom Provider Site Overrides</span>
          <span className="stremio-setting-subtext">Alternative mirror domains for scrapers</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '360px', width: '100%' }}>
          <button
            className="settings-btn-subtle"
            onClick={() => setShowAddSiteModal(true)}
            style={{ alignSelf: 'flex-start' }}
          >
            <Plus size={15} /> Add Custom Site
          </button>
          {settings.customSites.length > 0 && (
            <div className="custom-sites-grid" style={{ width: '100%' }}>
              {settings.customSites.map((site) => (
                <div key={site.id} className="custom-site-card">
                  <div>
                    <div className="custom-site-name">{site.name}</div>
                    <div className="custom-site-url">{site.url}</div>
                  </div>
                  <button
                    className="btn-icon-danger"
                    onClick={() => removeCustomSite(site.id)}
                    title="Remove override"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Benene Easter Egg */}
      <div className="stremio-setting-row" style={{ cursor: 'pointer' }} onClick={handleBeneneClick}>
        <div>
          <span className="stremio-setting-label">Benene Counter 🍌</span>
          <span className="stremio-setting-subtext">
            {settings.beneneCount === 0
              ? 'Click to harvest benene!'
              : `You currently have ${settings.beneneCount} benene!`}
          </span>
        </div>
        <span className="settings-counter-badge">{settings.beneneCount}</span>
      </div>

      {showEasterEgg && (
        <div className="benene-easter-egg-banner animate-fade-in">
          🐵 <strong>MONKE SURPRISE UNLOCKED!</strong> You clicked benene 20 times! Stay monke! 🍌
        </div>
      )}

      {/* Add Custom Site Modal */}
      {showAddSiteModal && (
        <div className="modal-backdrop">
          <div className="modal-card animate-scale-in">
            <h3 className="modal-title">Add Custom Site Override</h3>
            <form onSubmit={handleAddSite}>
              <div className="form-group">
                <label>Base Provider Template</label>
                <select
                  className="settings-select"
                  value={siteClass}
                  onChange={(e) => setSiteClass(e.target.value)}
                >
                  <option value="SuperStream">SuperStream (Movies & TV)</option>
                  <option value="FlixHQ">FlixHQ (Multi-source)</option>
                  <option value="GogoAnime">GogoAnime (Anime Streamer)</option>
                  <option value="SoraStream">SoraStream (Fast HD)</option>
                  <option value="CustomScraper">Custom Scraper API</option>
                </select>
              </div>

              <div className="form-group">
                <label>Custom Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. My Private Mirror"
                  className="settings-text-input"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Alternative Base URL</label>
                <input
                  type="url"
                  placeholder="https://mirror.example.com"
                  className="settings-text-input"
                  value={siteUrl}
                  onChange={(e) => setSiteUrl(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Language Code</label>
                <input
                  type="text"
                  placeholder="en"
                  className="settings-text-input"
                  value={siteLang}
                  onChange={(e) => setSiteLang(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="settings-btn-subtle"
                  onClick={() => setShowAddSiteModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="settings-btn-primary">
                  Save Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
