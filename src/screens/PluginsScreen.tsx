import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { PluginManifest, RepositoryManifest } from '../types';
import {
  Download,
  Globe,
  Puzzle,
  RefreshCw,
  Trash2,
  CheckCircle,
  Plus,
  FolderOpen,
  Link,
  Layers,
  Sparkles,
  CheckCheck,
} from 'lucide-react';

const PRESET_REPOSITORIES = [
  {
    name: "Nehal's Server (BDIX & CloudStream)",
    url: 'https://raw.githubusercontent.com/nehalDIU/nehal-CloudStream/master/repo.json',
  },
  {
    name: 'Hexated Providers',
    url: 'https://raw.githubusercontent.com/Hexated/cloudstream-extensions-hexated/master/repo.json',
  },
  {
    name: 'CloudStream Multilingual',
    url: 'https://raw.githubusercontent.com/recloudstream/cloudstream-extensions-multilingual/master/repo.json',
  },
];

interface PluginsScreenProps {
  onExtensionsChanged?: () => void;
  onSelectExtension?: (extName: string) => void;
}

export const PluginsScreen: React.FC<PluginsScreenProps> = ({ onExtensionsChanged, onSelectExtension }) => {
  const [repoUrl, setRepoUrl] = useState(PRESET_REPOSITORIES[0].url);
  const [repoName, setRepoName] = useState<string>("Nehal's Server");
  const [availablePlugins, setAvailablePlugins] = useState<PluginManifest[]>([]);
  const [installedPlugins, setInstalledPlugins] = useState<PluginManifest[]>([]);
  const [loading, setLoading] = useState(false);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installingAll, setInstallingAll] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Manual installation states
  const [showManualModal, setShowManualModal] = useState(false);
  const [directUrl, setDirectUrl] = useState('');
  const [directName, setDirectName] = useState('');
  const [localFilePath, setLocalFilePath] = useState('');
  const [activeTypeFilter, setActiveTypeFilter] = useState('All');

  const loadInstalled = async () => {
    try {
      const list: PluginManifest[] = await invoke('list_installed_plugins');
      setInstalledPlugins(list);
    } catch (e) {
      console.error('Failed to list installed plugins:', e);
    }
  };

  const handleFetchRepo = async (urlToFetch?: string) => {
    const target = (urlToFetch || repoUrl).trim();
    if (!target) return;
    setLoading(true);
    setMessage(null);
    try {
      const manifest: RepositoryManifest = await invoke('fetch_repository', { url: target });
      setRepoName(manifest.name);
      setAvailablePlugins(manifest.plugins);
      setMessage(`Successfully loaded ${manifest.plugins.length} extensions from "${manifest.name}"`);
    } catch (e) {
      console.error('Fetch repo error:', e);
      setMessage(`Failed to fetch repository: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInstalled();
    handleFetchRepo(PRESET_REPOSITORIES[0].url);
  }, []);

  const handleInstallPlugin = async (plugin: PluginManifest) => {
    setInstallingId(plugin.id);
    try {
      await invoke('install_plugin', { manifest: plugin });
      await loadInstalled();
      onExtensionsChanged?.();
      setMessage(`Successfully installed "${plugin.name}" (.cs3)`);
      // Update status in available list
      setAvailablePlugins((prev) =>
        prev.map((p) => (p.name === plugin.name ? { ...p, status: 'installed' } : p))
      );
    } catch (e) {
      console.error('Install plugin error:', e);
      setMessage(`Installation error: ${e}`);
    } finally {
      setInstallingId(null);
    }
  };

  const handleInstallAll = async () => {
    if (availablePlugins.length === 0) return;
    setInstallingAll(true);
    setMessage('Installing all extensions in parallel...');
    try {
      const count: number = await invoke('install_all_plugins', { plugins: availablePlugins });
      await loadInstalled();
      onExtensionsChanged?.();
      setMessage(`Successfully installed ${count} extensions!`);
      setAvailablePlugins((prev) => prev.map((p) => ({ ...p, status: 'installed' })));
    } catch (e) {
      console.error('Install all error:', e);
      setMessage(`Error installing all extensions: ${e}`);
    } finally {
      setInstallingAll(false);
    }
  };

  const handleDeletePlugin = async (name: string) => {
    try {
      await invoke('delete_plugin', { name });
      await loadInstalled();
      onExtensionsChanged?.();
      setMessage(`Removed extension "${name}"`);
      setAvailablePlugins((prev) =>
        prev.map((p) => (p.name === name ? { ...p, status: 'available' } : p))
      );
    } catch (e) {
      console.error('Delete plugin error:', e);
    }
  };

  const handleInstallDirectUrl = async () => {
    if (!directUrl.trim()) return;
    const name = directName.trim() || directUrl.split('/').filter(Boolean).pop() || 'CustomExtension';
    const manifest: PluginManifest = {
      id: name.toLowerCase().replace(/\s+/g, '_'),
      name,
      plugin_url: directUrl.trim(),
      version: 1,
      api_version: 1,
      tv_types: ['All'],
      authors: ['Custom URL'],
      description: 'Manually installed extension via URL.',
      status: 'available',
    };

    try {
      await invoke('install_plugin', { manifest });
      await loadInstalled();
      setMessage(`Installed custom extension "${name}"`);
      setShowManualModal(false);
      setDirectUrl('');
      setDirectName('');
    } catch (e) {
      alert(`Install failed: ${e}`);
    }
  };

  const handleInstallLocalFile = async () => {
    if (!localFilePath.trim()) return;
    try {
      await invoke('install_plugin_from_file', { filePath: localFilePath.trim() });
      await loadInstalled();
      setMessage(`Installed extension from local file: ${localFilePath}`);
      setShowManualModal(false);
      setLocalFilePath('');
    } catch (e) {
      alert(`Install from file failed: ${e}`);
    }
  };

  const isInstalled = (name: string) => {
    return installedPlugins.some((p) => p.name.toLowerCase() === name.toLowerCase());
  };

  const filteredPlugins = availablePlugins.filter((p) => {
    if (activeTypeFilter === 'All') return true;
    return p.tv_types.some((t) => t.toLowerCase().includes(activeTypeFilter.toLowerCase()));
  });

  return (
    <div style={{ padding: '40px 60px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Puzzle size={32} color="var(--primary)" />
            Extension & Repository Manager
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '6px' }}>
            Install and manage modular CloudStream extensions (<code style={{ color: 'var(--accent-cyan)' }}>.cs3</code> and <code style={{ color: 'var(--accent-cyan)' }}>.jar</code>) with Stremio-like instant launch.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="btn-secondary"
            onClick={() => setShowManualModal(true)}
            style={{ padding: '10px 18px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <FolderOpen size={16} color="var(--accent-cyan)" />
            Install from File / URL
          </button>

          {availablePlugins.length > 0 && (
            <button
              className="btn-primary"
              onClick={handleInstallAll}
              disabled={installingAll}
              style={{ padding: '10px 20px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <CheckCheck size={16} />
              {installingAll ? 'Installing All...' : 'Install All Extensions'}
            </button>
          )}
        </div>
      </div>

      {/* Preset Repositories Quick Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#8e8aa4', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Quick Repos:
        </span>
        {PRESET_REPOSITORIES.map((preset) => (
          <button
            key={preset.url}
            onClick={() => {
              setRepoUrl(preset.url);
              handleFetchRepo(preset.url);
            }}
            style={{
              padding: '6px 14px',
              borderRadius: '9999px',
              border: 'none',
              background: repoUrl === preset.url ? 'rgba(124, 58, 237, 0.3)' : 'rgba(255, 255, 255, 0.05)',
              color: repoUrl === preset.url ? '#fff' : '#8e8aa4',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <Globe size={13} color={repoUrl === preset.url ? 'var(--stremio-purple-light)' : '#8e8aa4'} />
            {preset.name}
          </button>
        ))}
      </div>

      {/* Repository URL Input Bar */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          background: 'rgba(255, 255, 255, 0.055)',
          padding: '8px 12px 8px 18px',
          borderRadius: '9999px',
          border: 'none',
          marginBottom: '20px',
          alignItems: 'center',
        }}
      >
        <Globe size={18} color="#8e8aa4" />
        <input
          type="text"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="Enter CloudStream repository URL (repo.json)..."
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#fff',
            fontSize: '14px',
            fontFamily: 'var(--font-body)',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleFetchRepo();
          }}
        />
        <button
          className="btn-primary"
          onClick={() => handleFetchRepo()}
          disabled={loading}
          style={{ padding: '8px 18px', fontSize: '13px', borderRadius: '9999px' }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Fetching...' : 'Sync Repo'}
        </button>
      </div>

      {message && (
        <div
          style={{
            padding: '12px 18px',
            background: 'rgba(124, 58, 237, 0.15)',
            border: 'none',
            borderRadius: '10px',
            color: '#c7d2fe',
            fontSize: '13px',
            marginBottom: '28px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <Sparkles size={16} color="var(--accent-cyan)" />
          {message}
        </div>
      )}

      {/* Installed Extensions Section */}
      <div style={{ marginBottom: '36px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle size={18} color="var(--accent-emerald)" />
          Installed Extensions ({installedPlugins.length})
        </h2>

        {installedPlugins.length === 0 ? (
          <div style={{ padding: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: 'none', color: '#8e8aa4', fontSize: '14px' }}>
            No custom extensions installed yet. Click <strong>"Install"</strong> on any extension below to activate it!
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {installedPlugins.map((p) => (
              <div
                key={p.id}
                style={{
                  padding: '16px 20px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  borderRadius: '12px',
                  border: 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, color: '#fff', fontSize: '15px' }}>{p.name}</span>
                    <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                      ACTIVE
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    v{p.version} • {p.authors.join(', ') || 'Community'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {onSelectExtension && (
                    <button
                      onClick={() => onSelectExtension(p.name)}
                      className="btn-primary"
                      style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      title="Select and browse this extension on Home feed"
                    >
                      <Globe size={13} />
                      Browse
                    </button>
                  )}
                  <button
                    onClick={() => handleDeletePlugin(p.name)}
                    style={{
                      background: 'rgba(244, 63, 94, 0.15)',
                      color: '#f43f5e',
                      border: 'none',
                      padding: '8px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                    title="Uninstall extension"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Available Extensions List from Repository */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="var(--primary)" />
            Available Extensions from {repoName} ({filteredPlugins.length})
          </h2>

          {/* Type filters */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {['All', 'Movie', 'Anime', 'FTP'].map((type) => (
              <button
                key={type}
                onClick={() => setActiveTypeFilter(type)}
                style={{
                  padding: '5px 14px',
                  borderRadius: '9999px',
                  border: 'none',
                  background: activeTypeFilter === type ? 'rgba(124, 58, 237, 0.35)' : 'rgba(255, 255, 255, 0.05)',
                  color: activeTypeFilter === type ? '#fff' : '#8e8aa4',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {filteredPlugins.map((plugin) => {
            const installed = isInstalled(plugin.name);
            return (
              <div
                key={plugin.id}
                style={{
                  padding: '20px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  borderRadius: '14px',
                  border: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: 'none',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {plugin.icon_url && (
                        <img
                          src={plugin.icon_url}
                          alt={plugin.name}
                          style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'contain' }}
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                      )}
                      <div style={{ fontWeight: 700, fontSize: '16px', color: '#fff' }}>{plugin.name}</div>
                    </div>
                    <span style={{ fontSize: '11px', color: '#8e8aa4', fontWeight: 600 }}>v{plugin.version}</span>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    {plugin.tv_types.map((t) => (
                      <span
                        key={t}
                        style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          background: 'rgba(255, 255, 255, 0.06)',
                          color: '#c7d2fe',
                          padding: '2px 8px',
                          borderRadius: '9999px',
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>

                  <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.5', marginBottom: '16px' }}>
                    {plugin.description || 'CloudStream provider plugin with media scraping and link extraction.'}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: '12px', color: '#8e8aa4' }}>
                    {plugin.authors.length > 0 ? `By ${plugin.authors.join(', ')}` : 'Community'}
                  </span>

                  {installed ? (
                    <button
                      onClick={() => handleDeletePlugin(plugin.name)}
                      style={{
                        padding: '6px 14px',
                        fontSize: '12px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: 'none',
                        color: '#6ee7b7',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 600,
                      }}
                    >
                      <CheckCircle size={13} />
                      Installed
                    </button>
                  ) : (
                    <button
                      className="btn-primary"
                      onClick={() => handleInstallPlugin(plugin)}
                      disabled={installingId === plugin.id}
                      style={{ padding: '6px 16px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Download size={14} />
                      {installingId === plugin.id ? 'Installing...' : 'Install'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Install from File / URL Modal */}
      {showManualModal && (
        <div className="modal-backdrop" onClick={() => setShowManualModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px', padding: '32px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Plus size={22} color="var(--primary)" />
              Install Custom Extension
            </h2>

            {/* Option 1: Local File */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FolderOpen size={16} color="var(--accent-cyan)" />
                Option 1: Install from Local File (.cs3 / .jar)
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="e.g. D:\Downloads\MyExtension.cs3"
                  value={localFilePath}
                  onChange={(e) => setLocalFilePath(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: '13px',
                  }}
                />
                <button className="btn-primary" onClick={handleInstallLocalFile} style={{ padding: '8px 18px', fontSize: '13px' }}>
                  Install File
                </button>
              </div>
            </div>

            {/* Option 2: Direct URL */}
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Link size={16} color="var(--primary)" />
                Option 2: Install from Direct URL (.cs3 / .jar)
              </div>
              <input
                type="text"
                placeholder="Extension Name (e.g. NetMirror)"
                value={directName}
                onChange={(e) => setDirectName(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  color: '#fff',
                  fontSize: '13px',
                  marginBottom: '10px',
                }}
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="https://.../extension.cs3"
                  value={directUrl}
                  onChange={(e) => setDirectUrl(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: '13px',
                  }}
                />
                <button className="btn-primary" onClick={handleInstallDirectUrl} style={{ padding: '8px 18px', fontSize: '13px' }}>
                  Download & Install
                </button>
              </div>
            </div>

            <div style={{ marginTop: '28px', textAlign: 'right' }}>
              <button className="btn-secondary" onClick={() => setShowManualModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
