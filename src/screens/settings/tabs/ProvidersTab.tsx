import React, { useState, useEffect } from 'react';
import { useSettings } from '../../../hooks/useSettings';
import { Check, Cpu, RefreshCw, Download, FolderOpen, Copy, CheckCheck, Trash2, HardDrive } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { LANGUAGES } from '../../../utils/subtitleHelper';
import { EngineStatus, AppDirectoryInfo, CacheClearResult } from '../../../types';

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
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);
  const [isRestarting, setIsRestarting] = useState(false);
  const [extDir, setExtDir] = useState<AppDirectoryInfo | null>(null);
  const [copiedPath, setCopiedPath] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanNotice, setCleanNotice] = useState<string | null>(null);

  const fetchDirectory = async () => {
    try {
      const dirs: AppDirectoryInfo[] = await invoke('get_storage_directories', {
        customDownloadPath: settings.downloadPath || null,
      });
      const found = dirs.find((d) => d.id === 'extensions');
      if (found) setExtDir(found);
    } catch (e) {
      console.error('Failed to get extension directory info:', e);
    }
  };

  useEffect(() => {
    let mounted = true;
    const fetchStatus = async () => {
      try {
        const st: EngineStatus = await invoke('get_engine_status');
        if (mounted) setEngineStatus(st);
      } catch (e) {
        console.error('Failed to get engine status in settings:', e);
      }
    };
    fetchStatus();
    fetchDirectory();
    return () => { mounted = false; };
  }, [settings.downloadPath]);

  const handleRestartEngine = async () => {
    setIsRestarting(true);
    try {
      const st: EngineStatus = await invoke('restart_engine');
      setEngineStatus(st);
      await fetchDirectory();
    } catch (e) {
      console.error('Failed to restart engine:', e);
    } finally {
      setIsRestarting(false);
    }
  };

  const handleOpenFolder = async (path: string) => {
    try {
      await invoke('open_directory', { path });
    } catch (e) {
      console.error('Failed to open directory:', e);
    }
  };

  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  const handleCleanOrphaned = async () => {
    setIsCleaning(true);
    try {
      const res: CacheClearResult = await invoke('clear_directory_cache', { target: 'orphaned_plugins' });
      setCleanNotice(res.message);
      await fetchDirectory();
      setTimeout(() => setCleanNotice(null), 4000);
    } catch (e) {
      console.error('Failed to clean orphaned plugins:', e);
    } finally {
      setIsCleaning(false);
    }
  };

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

      {/* Extensions Save Location & Management */}
      <div className="stremio-settings-section-divider" style={{ margin: '24px 0 16px', borderTop: '1px solid rgba(255,255,255,0.08)' }} />

      <div className="stremio-setting-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
          <div className="stremio-setting-label-col">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FolderOpen size={18} color="#a78bfa" />
              <span className="stremio-setting-label">Extensions Save Location</span>
              {extDir && (
                <span className="settings-badge" style={{ background: 'rgba(167, 139, 250, 0.15)', color: '#c4b5fd', border: '1px solid rgba(167, 139, 250, 0.3)' }}>
                  {extDir.file_count} Files • {extDir.formatted_size}
                </span>
              )}
            </div>
            <span className="stremio-setting-subtext">
              Local filesystem directory where CloudStream .cs3 provider extension files are stored and executed
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {extDir && (
              <button
                className="btn-secondary"
                onClick={() => handleOpenFolder(extDir.path)}
                style={{ padding: '6px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Open extensions folder in File Explorer"
              >
                <FolderOpen size={14} />
                <span>Open in Explorer</span>
              </button>
            )}

            <button
              className="btn-secondary"
              onClick={handleCleanOrphaned}
              disabled={isCleaning}
              style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171' }}
              title="Remove orphaned or corrupted plugin files"
            >
              <Trash2 size={13} />
              <span>{isCleaning ? 'Cleaning...' : 'Clean Orphaned'}</span>
            </button>
          </div>
        </div>

        {/* Path Display & Action Pill */}
        {extDir && (
          <div
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(23, 20, 45, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '10px 14px',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
              <HardDrive size={15} color="#94a3b8" style={{ flexShrink: 0 }} />
              <span
                style={{
                  fontFamily: 'Consolas, monospace',
                  fontSize: '12.5px',
                  color: '#e2e8f0',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  userSelect: 'all',
                }}
                title={extDir.path}
              >
                {extDir.path}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <button
                className="settings-btn-subtle"
                onClick={() => handleCopyPath(extDir.path)}
                style={{ padding: '4px 10px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '5px' }}
                title="Copy path to clipboard"
              >
                {copiedPath ? <CheckCheck size={13} color="#10b981" /> : <Copy size={13} />}
                <span>{copiedPath ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        )}

        {cleanNotice && (
          <div style={{ fontSize: '12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCheck size={14} />
            <span>{cleanNotice}</span>
          </div>
        )}

        <div style={{ fontSize: '11.5px', color: '#94a3b8', background: 'rgba(255, 255, 255, 0.03)', padding: '8px 12px', borderRadius: '6px', width: '100%' }}>
          💡 <strong style={{ color: '#e2e8f0' }}>Tip:</strong> You can directly paste or drop custom <code style={{ color: '#a78bfa' }}>.cs3</code> plugin files into this folder and click <strong>Restart Engine</strong> below to load them instantly.
        </div>
      </div>

      {/* Extension Engine Diagnostics & Health */}
      <div className="stremio-settings-section-divider" style={{ margin: '24px 0 16px', borderTop: '1px solid rgba(255,255,255,0.08)' }} />
      
      <div className="stremio-setting-row" style={{ alignItems: 'flex-start' }}>
        <div className="stremio-setting-label-col">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={18} color="var(--stremio-purple-light)" />
            <span className="stremio-setting-label">Extension Engine (.cs3 Runner)</span>
          </div>
          <span className="stremio-setting-subtext">
            Background JVM runner for executing CloudStream provider plugins on desktop
          </span>
          {engineStatus && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>
              <div>Java Runtime: <span style={{ color: '#f1f5f9' }}>{engineStatus.java_path || (engineStatus.java_found ? 'Detected' : 'Not Found')}</span> {engineStatus.java_is_bundled && <span style={{ color: '#10b981', marginLeft: 4 }}>(Bundled JRE)</span>}</div>
              <div>Engine JAR: <span style={{ color: '#f1f5f9' }}>{engineStatus.engine_jar_found ? (engineStatus.engine_jar_path || 'Found') : 'Missing'}</span></div>
              <div>Active Providers: <span style={{ color: '#f1f5f9' }}>{engineStatus.providers_count}</span></div>
              {engineStatus.error && <div style={{ color: '#ef4444', marginTop: 4 }}>Error: {engineStatus.error}</div>}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 600,
                background: engineStatus?.is_healthy ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: engineStatus?.is_healthy ? '#34d399' : '#f87171',
                border: `1px solid ${engineStatus?.is_healthy ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: engineStatus?.is_healthy ? '#34d399' : '#f87171',
                }}
              />
              {engineStatus?.is_healthy ? 'Engine Online' : 'Engine Offline'}
            </span>

            <button
              className="btn-secondary"
              onClick={handleRestartEngine}
              disabled={isRestarting}
              style={{ padding: '6px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={13} className={isRestarting ? 'animate-spin' : ''} />
              {isRestarting ? 'Restarting...' : 'Restart Engine'}
            </button>
          </div>

          {engineStatus && !engineStatus.java_found && (
            <button
              className="btn-primary"
              onClick={() => openUrl('https://adoptium.net/temurin/releases/?version=17')}
              style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={12} />
              Download Java 17+
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
