import React, { useState, useEffect } from 'react';
import { useSettings } from '../../../hooks/useSettings';
import { invoke } from '@tauri-apps/api/core';
import { FolderOpen, Trash2, CheckCircle2 } from 'lucide-react';
import { AppDirectoryInfo, CacheClearResult } from '../../../types';

export const StreamingTab: React.FC = () => {
  const { settings, updateSetting } = useSettings();
  const [cacheInfo, setCacheInfo] = useState<AppDirectoryInfo | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [clearMessage, setClearMessage] = useState<string | null>(null);

  const fetchCacheInfo = async () => {
    try {
      const dirs: AppDirectoryInfo[] = await invoke('get_storage_directories', {
        customDownloadPath: settings.downloadPath || null,
      });
      const found = dirs.find((d) => d.id === 'cache');
      if (found) setCacheInfo(found);
    } catch (e) {
      console.error('Failed to get cache directory info:', e);
    }
  };

  useEffect(() => {
    fetchCacheInfo();
  }, []);

  const handleClearCache = async () => {
    setIsClearing(true);
    try {
      const res: CacheClearResult = await invoke('clear_directory_cache', { target: 'cache' });
      setClearMessage(res.message);
      await fetchCacheInfo();
      setTimeout(() => setClearMessage(null), 4000);
    } catch (e) {
      console.error('Failed to clear streaming cache:', e);
    } finally {
      setIsClearing(false);
    }
  };

  const handleOpenCacheFolder = async () => {
    if (cacheInfo) {
      try {
        await invoke('open_directory', { path: cacheInfo.path });
      } catch (e) {
        console.error('Failed to open cache directory:', e);
      }
    }
  };

  return (
    <div className="stremio-settings-tab-pane animate-fade-in">
      {clearMessage && (
        <div className="settings-success-banner animate-fade-in" style={{ marginBottom: '16px' }}>
          <CheckCircle2 size={16} />
          <span>{clearMessage}</span>
        </div>
      )}

      {/* DNS over HTTPS (DoH) */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">DNS over HTTPS (DoH)</span>
          <span className="stremio-setting-subtext">Encrypted DNS queries preventing ISP censorship & DNS poisoning</span>
        </div>
        <select
          className="stremio-select"
          value={settings.dohProvider}
          onChange={(e) => updateSetting('dohProvider', e.target.value as any)}
        >
          <option value="cloudflare">Cloudflare (1.1.1.1)</option>
          <option value="google">Google Public DNS (8.8.8.8)</option>
          <option value="adguard">AdGuard DNS</option>
          <option value="quad9">Quad9 (9.9.9.9)</option>
          <option value="cleanbrowsing">CleanBrowsing</option>
          <option value="system">Operating System Default</option>
        </select>
      </div>

      {/* Domestic Gigabit BDIX Proxy */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Domestic Gigabit BDIX Proxy</span>
          <span className="stremio-setting-subtext">Route streaming sources through high-speed peering exchange</span>
        </div>
        <label className="stremio-switch">
          <input
            type="checkbox"
            checked={settings.useBdxProxy}
            onChange={(e) => updateSetting('useBdxProxy', e.target.checked)}
          />
          <span className="stremio-switch-slider" />
        </label>
      </div>

      {/* jsDelivr GitHub CDN Mirror */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">jsDelivr GitHub CDN Mirror</span>
          <span className="stremio-setting-subtext">Accelerates plugin repository index retrieval</span>
        </div>
        <label className="stremio-switch">
          <input
            type="checkbox"
            checked={settings.useJsdelivrProxy}
            onChange={(e) => updateSetting('useJsdelivrProxy', e.target.checked)}
          />
          <span className="stremio-switch-slider" />
        </label>
      </div>

      {/* Disk Buffer Size */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Disk Cache Buffer</span>
          <span className="stremio-setting-subtext">Pre-allocated disk storage for video playback chunks</span>
        </div>
        <div className="settings-slider-wrapper">
          <input
            type="range"
            min={0}
            max={500}
            step={25}
            value={settings.bufferDiskMb}
            onChange={(e) => updateSetting('bufferDiskMb', parseInt(e.target.value))}
            className="settings-slider"
            style={{
              background: `linear-gradient(to right, var(--stremio-purple, #7c3aed) 0%, var(--stremio-purple, #7c3aed) ${(settings.bufferDiskMb / 500) * 100}%, rgba(255, 255, 255, 0.1) ${(settings.bufferDiskMb / 500) * 100}%, rgba(255, 255, 255, 0.1) 100%)`,
            }}
          />
          <span className="settings-badge">
            {settings.bufferDiskMb === 0 ? 'Automatic' : `${settings.bufferDiskMb} MB`}
          </span>
        </div>
      </div>

      {/* RAM Buffer Size */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">RAM Memory Buffer</span>
          <span className="stremio-setting-subtext">High-speed RAM buffer for smooth seeking</span>
        </div>
        <div className="settings-slider-wrapper">
          <input
            type="range"
            min={0}
            max={500}
            step={25}
            value={settings.bufferRamMb}
            onChange={(e) => updateSetting('bufferRamMb', parseInt(e.target.value))}
            className="settings-slider"
            style={{
              background: `linear-gradient(to right, var(--stremio-purple, #7c3aed) 0%, var(--stremio-purple, #7c3aed) ${(settings.bufferRamMb / 500) * 100}%, rgba(255, 255, 255, 0.1) ${(settings.bufferRamMb / 500) * 100}%, rgba(255, 255, 255, 0.1) 100%)`,
            }}
          />
          <span className="settings-badge">
            {settings.bufferRamMb === 0 ? 'Automatic' : `${settings.bufferRamMb} MB`}
          </span>
        </div>
      </div>

      {/* Concurrent Connections per Stream */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Concurrent Connections per Stream</span>
          <span className="stremio-setting-subtext">Multi-threaded chunk streams for maximum download speeds</span>
        </div>
        <div className="settings-slider-wrapper">
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={settings.concurrentConnections}
            onChange={(e) => updateSetting('concurrentConnections', parseInt(e.target.value))}
            className="settings-slider"
            style={{
              background: `linear-gradient(to right, var(--stremio-purple, #7c3aed) 0%, var(--stremio-purple, #7c3aed) ${((settings.concurrentConnections - 1) / 9) * 100}%, rgba(255, 255, 255, 0.1) ${((settings.concurrentConnections - 1) / 9) * 100}%, rgba(255, 255, 255, 0.1) 100%)`,
            }}
          />
          <span className="settings-badge">{settings.concurrentConnections} Threads</span>
        </div>
      </div>

      {/* Streaming Disk Cache Row */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="stremio-setting-label">Streaming Disk Cache</span>
            {cacheInfo && (
              <span
                className="settings-badge"
                style={{
                  background: 'rgba(244, 63, 94, 0.15)',
                  color: '#fda4af',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                }}
              >
                {cacheInfo.file_count} Files • {cacheInfo.formatted_size}
              </span>
            )}
          </div>
          <span className="stremio-setting-subtext">
            Free up disk space occupied by cached HLS video segments and stream buffers
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {cacheInfo && (
            <button
              className="btn-secondary"
              onClick={handleOpenCacheFolder}
              style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
              title="Open cache folder in File Explorer"
            >
              <FolderOpen size={13} />
              <span>Open Folder</span>
            </button>
          )}

          <button
            className="btn-secondary"
            onClick={handleClearCache}
            disabled={isClearing}
            style={{ padding: '6px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: '#f43f5e' }}
            title="Clear temporary stream cache"
          >
            <Trash2 size={13} />
            <span>{isClearing ? 'Clearing...' : 'Clear Cache'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};


