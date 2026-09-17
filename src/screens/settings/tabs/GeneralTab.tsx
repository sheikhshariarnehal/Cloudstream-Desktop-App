import React, { useState, useEffect } from 'react';
import { useSettings } from '../../../hooks/useSettings';
import {
  Plus,
  Trash2,
  FolderOpen,
  Folder,
  HardDrive,
  Database,
  Cpu,
  Film,
  RefreshCw,
  Copy,
  CheckCheck,
  RotateCcw,
  Puzzle,
  CheckCircle2,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { AppDirectoryInfo, CacheClearResult } from '../../../types';

export const GeneralTab: React.FC = () => {
  const { settings, updateSetting, addCustomSite, removeCustomSite } = useSettings();
  const [showAddSiteModal, setShowAddSiteModal] = useState(false);
  const [siteName, setSiteName] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [siteLang, setSiteLang] = useState('en');
  const [siteClass, setSiteClass] = useState('SuperStream');
  const [showEasterEgg, setShowEasterEgg] = useState(false);

  // Directory management states
  const [directories, setDirectories] = useState<AppDirectoryInfo[]>([]);
  const [loadingDirs, setLoadingDirs] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isClearingCache, setIsClearingCache] = useState(false);

  const loadDirectories = async () => {
    setLoadingDirs(true);
    try {
      const dirs: AppDirectoryInfo[] = await invoke('get_storage_directories', {
        customDownloadPath: settings.downloadPath || null,
      });
      setDirectories(dirs);
    } catch (e) {
      console.error('Failed to load storage directories:', e);
    } finally {
      setLoadingDirs(false);
    }
  };

  useEffect(() => {
    loadDirectories();
  }, [settings.downloadPath]);

  const handleOpenDirectory = async (path: string) => {
    try {
      await invoke('open_directory', { path });
    } catch (e) {
      console.error('Failed to open directory:', e);
    }
  };

  const handleBrowseFolder = async () => {
    try {
      const chosen: string | null = await invoke('select_folder', {
        defaultPath: settings.downloadPath || null,
      });
      if (chosen) {
        updateSetting('downloadPath', chosen);
        setActionNotice(`Download directory set to: ${chosen}`);
        setTimeout(() => setActionNotice(null), 4000);
      }
    } catch (e) {
      console.error('Failed to pick folder:', e);
    }
  };

  const handleResetDownloadPath = () => {
    updateSetting('downloadPath', 'Downloads/CloudStream');
    setActionNotice('Download directory reset to default (Downloads/CloudStream)');
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleCopyPath = (key: string, path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      const res: CacheClearResult = await invoke('clear_directory_cache', { target: 'cache' });
      setActionNotice(res.message);
      await loadDirectories();
      setTimeout(() => setActionNotice(null), 4000);
    } catch (e) {
      console.error('Failed to clear cache:', e);
    } finally {
      setIsClearingCache(false);
    }
  };

  const getDirectoryIcon = (id: string) => {
    switch (id) {
      case 'extensions':
        return <Puzzle size={18} color="#a78bfa" />;
      case 'downloads':
        return <Film size={18} color="#38bdf8" />;
      case 'app_data':
        return <Database size={18} color="#34d399" />;
      case 'engine':
        return <Cpu size={18} color="#f59e0b" />;
      case 'cache':
        return <HardDrive size={18} color="#f43f5e" />;
      case 'mpv':
        return <Film size={18} color="#c084fc" />;
      default:
        return <FolderOpen size={18} color="#94a3b8" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Extensions':
        return { bg: 'rgba(167, 139, 250, 0.15)', text: '#c4b5fd', border: 'rgba(167, 139, 250, 0.3)' };
      case 'Storage':
        return { bg: 'rgba(56, 189, 248, 0.15)', text: '#7dd3fc', border: 'rgba(56, 189, 248, 0.3)' };
      case 'Database':
        return { bg: 'rgba(52, 211, 153, 0.15)', text: '#6ee7b7', border: 'rgba(52, 211, 153, 0.3)' };
      case 'Runtime':
        return { bg: 'rgba(245, 158, 11, 0.15)', text: '#fcd34d', border: 'rgba(245, 158, 11, 0.3)' };
      case 'Cache':
        return { bg: 'rgba(244, 63, 94, 0.15)', text: '#fda4af', border: 'rgba(244, 63, 94, 0.3)' };
      default:
        return { bg: 'rgba(255, 255, 255, 0.08)', text: '#e2e8f0', border: 'rgba(255, 255, 255, 0.15)' };
    }
  };

  const downloadDirInfo = directories.find((d) => d.id === 'downloads');

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
      {/* Toast / Notification Banner */}
      {actionNotice && (
        <div className="settings-success-banner animate-fade-in" style={{ marginBottom: '16px' }}>
          <CheckCircle2 size={16} />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Offline Video Downloads Directory Setting */}
      <div className="stremio-setting-row" style={{ alignItems: 'flex-start' }}>
        <div className="stremio-setting-label-col">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="stremio-setting-label">Offline Downloads Directory</span>
            {downloadDirInfo && (
              <span
                className="settings-badge"
                style={{
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#7dd3fc',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                }}
              >
                {downloadDirInfo.file_count} Files • {downloadDirInfo.formatted_size}
              </span>
            )}
          </div>
          <span className="stremio-setting-subtext">
            Destination folder for offline downloaded movies, TV episodes, and anime video files
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '440px', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
            <input
              type="text"
              className="settings-text-input"
              value={settings.downloadPath}
              onChange={(e) => updateSetting('downloadPath', e.target.value)}
              placeholder="e.g. C:\Users\Username\Downloads\CloudStream"
              style={{ flex: 1 }}
            />
            <button
              className="btn-secondary"
              onClick={handleBrowseFolder}
              style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
              title="Browse computer for download directory"
            >
              <Folder size={13} />
              <span>Browse...</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
            {downloadDirInfo && (
              <button
                className="settings-btn-subtle"
                onClick={() => handleOpenDirectory(downloadDirInfo.path)}
                style={{ padding: '4px 10px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '5px' }}
                title="Open download folder in Windows File Explorer"
              >
                <FolderOpen size={12} />
                <span>Open Folder</span>
              </button>
            )}

            <button
              className="settings-btn-subtle"
              onClick={handleResetDownloadPath}
              style={{ padding: '4px 10px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '5px' }}
              title="Reset download path to default"
            >
              <RotateCcw size={12} />
              <span>Default</span>
            </button>
          </div>
        </div>
      </div>

      {/* System Storage & Directories Overview Hub */}
      <div className="stremio-settings-section-divider" style={{ margin: '24px 0 16px', borderTop: '1px solid rgba(255,255,255,0.08)' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HardDrive size={18} color="var(--stremio-purple-light)" />
              <span className="stremio-setting-label">System Storage & Directories</span>
            </div>
            <span className="stremio-setting-subtext">
              View, open, and manage filesystem locations used by CloudStream Desktop
            </span>
          </div>

          <button
            className="btn-secondary"
            onClick={loadDirectories}
            disabled={loadingDirs}
            style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Refresh directory metrics and disk usage"
          >
            <RefreshCw size={13} className={loadingDirs ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Directory Grid */}
        <div className="storage-directory-grid">
          {directories.map((dir) => {
            const catColors = getCategoryColor(dir.category);
            const isCopied = copiedKey === dir.id;

            return (
              <div key={dir.id} className="storage-directory-card">
                <div className="storage-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="storage-icon-wrapper">{getDirectoryIcon(dir.id)}</div>
                    <div>
                      <div className="storage-card-title">{dir.name}</div>
                      <div className="storage-card-desc">{dir.description}</div>
                    </div>
                  </div>

                  <span
                    className="storage-category-badge"
                    style={{
                      background: catColors.bg,
                      color: catColors.text,
                      border: `1px solid ${catColors.border}`,
                    }}
                  >
                    {dir.category}
                  </span>
                </div>

                {/* Path Pill */}
                <div className="storage-path-pill">
                  <span className="storage-path-text" title={dir.path}>
                    {dir.path}
                  </span>
                  <button
                    className="storage-pill-btn"
                    onClick={() => handleCopyPath(dir.id, dir.path)}
                    title="Copy full path"
                  >
                    {isCopied ? <CheckCheck size={12} color="#10b981" /> : <Copy size={12} />}
                    <span>{isCopied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                {/* Card Footer */}
                <div className="storage-card-footer">
                  <div className="storage-stats-badge">
                    <span>{dir.file_count} {dir.file_count === 1 ? 'item' : 'items'}</span>
                    <span style={{ opacity: 0.4 }}>•</span>
                    <span style={{ fontWeight: 600 }}>{dir.formatted_size}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {dir.can_clear && (
                      <button
                        className="btn-secondary"
                        onClick={handleClearCache}
                        disabled={isClearingCache}
                        style={{ padding: '5px 10px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '5px', color: '#f43f5e' }}
                        title="Clear temporary cache files"
                      >
                        <Trash2 size={12} />
                        <span>{isClearingCache ? 'Clearing...' : 'Clear Cache'}</span>
                      </button>
                    )}

                    {dir.can_open && (
                      <button
                        className="btn-secondary"
                        onClick={() => handleOpenDirectory(dir.path)}
                        style={{ padding: '5px 12px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '5px' }}
                        title="Open folder in File Explorer"
                      >
                        <FolderOpen size={12} />
                        <span>Open Folder</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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
