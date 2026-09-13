import React, { useEffect, useState, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { PluginManifest, RepositoryEntry, RepositoryManifest } from '../types';
import { getLanguageMetadata } from '../utils/subtitleHelper';
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
  Search,
  ArrowLeft,
  ExternalLink,
  ThumbsUp,
  Copy,
  Server,
  X,
  HardDrive,
  Check,
  Share2,
} from 'lucide-react';

const PRESET_REPOSITORIES = [
  {
    name: "Nehal's Server (BDIX & CloudStream)",
    url: 'https://raw.githubusercontent.com/nehalDIU/nehal-CloudStream/master/repo.json',
    description: 'High-speed domestic BDIX gigabit providers, CineplexBD, AllWish, FTP, and domestic streaming servers.',
  },
  {
    name: 'Hexated Providers',
    url: 'https://raw.githubusercontent.com/Hexated/cloudstream-extensions-hexated/master/repo.json',
    description: 'Comprehensive global movie, series, and multi-host scraping providers maintained by Hexated.',
  },
  {
    name: 'CloudStream Multilingual',
    url: 'https://raw.githubusercontent.com/recloudstream/cloudstream-extensions-multilingual/master/repo.json',
    description: 'Official global repository supporting French, Spanish, German, Hindi, Arabic, and multilingual sources.',
  },
  {
    name: 'Stormunblessed (Anime & Media)',
    url: 'https://raw.githubusercontent.com/Stormunblessed/stormunblessed-cs3/master/repo.json',
    description: 'Specialized anime, drama, and light novel media providers with rich metadata extraction.',
  },
];

const TV_TYPES_LIST = [
  'All',
  'Movie',
  'TvSeries',
  'Anime',
  'AsianDrama',
  'Cartoon',
  'Documentary',
  'LiveStream',
  'Torrent',
  'NSFW',
];

interface PluginsScreenProps {
  onExtensionsChanged?: () => void;
  onSelectExtension?: (extName: string) => void;
}

export const PluginsScreen: React.FC<PluginsScreenProps> = ({ onExtensionsChanged, onSelectExtension }) => {
  // Main view navigation: 'repositories' | 'installed'
  const [activeTab, setActiveTab] = useState<'repositories' | 'installed'>('repositories');

  // Currently inspected repository for detailed browsing (PluginsFragment equivalent)
  const [selectedRepo, setSelectedRepo] = useState<RepositoryEntry | null>(null);

  // Data states
  const [repositories, setRepositories] = useState<RepositoryEntry[]>([]);
  const [installedPlugins, setInstalledPlugins] = useState<PluginManifest[]>([]);
  const [repoPluginsMap, setRepoPluginsMap] = useState<Record<string, PluginManifest[]>>({});

  // Loading & Action states
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingPlugins, setLoadingPlugins] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installingAll, setInstallingAll] = useState(false);
  const [installProgress, setInstallProgress] = useState<{ current: number; total: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Filter & Search states
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [repoSearchQuery, setRepoSearchQuery] = useState('');
  const [installedSearchQuery, setInstalledSearchQuery] = useState('');
  const [activeTvType, setActiveTvType] = useState('All');
  const [selectedLang, setSelectedLang] = useState('All');

  // Modals
  const [showAddRepoModal, setShowAddRepoModal] = useState(false);
  const [newRepoUrl, setNewRepoUrl] = useState('');
  const [newRepoName, setNewRepoName] = useState('');
  const [isAddingRepo, setIsAddingRepo] = useState(false);

  const [showManualModal, setShowManualModal] = useState(false);
  const [directUrl, setDirectUrl] = useState('');
  const [directName, setDirectName] = useState('');
  const [localFilePath, setLocalFilePath] = useState('');

  // Plugin Details Modal (PluginDetailsFragment equivalent)
  const [detailPlugin, setDetailPlugin] = useState<PluginManifest | null>(null);

  // Community votes tracking (Countify simulation / local state)
  const [votesMap, setVotesMap] = useState<Record<string, { count: number; userVoted: boolean }>>(() => {
    try {
      const saved = localStorage.getItem('cloudstream_plugin_votes');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Helper to format filesize
  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Helper for language display with flag
  const getLanguageInfo = (langCode?: string) => {
    if (!langCode || langCode.toLowerCase() === 'none') {
      return { name: 'Universal', flag: '🌐' };
    }
    const meta = getLanguageMetadata(langCode);
    if (meta) {
      return { name: meta.languageName, flag: meta.flag || '🌐' };
    }
    return { name: langCode.toUpperCase(), flag: '🌐' };
  };

  // Load Repositories from SQLite
  const loadRepositories = async () => {
    setLoadingRepos(true);
    try {
      const list: RepositoryEntry[] = await invoke('get_repositories');
      setRepositories(list);
    } catch (e) {
      console.error('Failed to load repositories:', e);
    } finally {
      setLoadingRepos(false);
    }
  };

  // Load Installed Plugins (.cs3 files)
  const loadInstalled = async () => {
    try {
      const list: PluginManifest[] = await invoke('list_installed_plugins');
      setInstalledPlugins(list);
    } catch (e) {
      console.error('Failed to list installed plugins:', e);
    }
  };

  // Fetch / Sync a specific repository manifest
  const fetchRepoPlugins = async (repoUrl: string, force = false): Promise<PluginManifest[]> => {
    if (!force && repoPluginsMap[repoUrl]) {
      return repoPluginsMap[repoUrl];
    }
    setLoadingPlugins(true);
    try {
      const manifest: RepositoryManifest = await invoke('fetch_repository', { url: repoUrl });
      setRepoPluginsMap((prev) => ({ ...prev, [repoUrl]: manifest.plugins }));
      return manifest.plugins;
    } catch (e) {
      console.error(`Failed to fetch repo ${repoUrl}:`, e);
      setMessage(`Failed to fetch repository: ${e}`);
      return [];
    } finally {
      setLoadingPlugins(false);
    }
  };

  // Initial Boot
  useEffect(() => {
    loadRepositories();
    loadInstalled();
  }, []);

  // When repositories load, pre-fetch plugins for first repository
  useEffect(() => {
    if (repositories.length > 0) {
      fetchRepoPlugins(repositories[0].url);
    }
  }, [repositories]);

  // When a repository is selected, fetch its plugins if not cached
  useEffect(() => {
    if (selectedRepo) {
      fetchRepoPlugins(selectedRepo.url);
      setActiveTvType('All');
      setSelectedLang('All');
      setRepoSearchQuery('');
    }
  }, [selectedRepo]);

  // Copy shareable link <name> : <url>
  const handleCopyShareLink = (repo: RepositoryEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    const shareText = `${repo.name} : ${repo.url}`;
    navigator.clipboard.writeText(shareText);
    setCopyFeedback(`Copied "${repo.name}" share link to clipboard!`);
    setTimeout(() => setCopyFeedback(null), 3000);
  };

  // Add Repository with Auto-paste detection
  const handleAddRepo = async (overrideUrl?: string, overrideName?: string) => {
    const urlToAdd = (overrideUrl || newRepoUrl).trim();
    if (!urlToAdd) return;
    const nameToAdd = (overrideName || newRepoName).trim() || undefined;

    setIsAddingRepo(true);
    setMessage(null);
    try {
      const entry: RepositoryEntry = await invoke('add_repository', {
        url: urlToAdd,
        name: nameToAdd,
      });
      await loadRepositories();
      await fetchRepoPlugins(entry.url, true);
      setMessage(`Successfully added repository "${entry.name}"`);
      setShowAddRepoModal(false);
      setNewRepoUrl('');
      setNewRepoName('');
    } catch (e) {
      console.error('Failed to add repository:', e);
      alert(`Could not add repository: ${e}`);
    } finally {
      setIsAddingRepo(false);
    }
  };

  // Smart Clipboard Paste for Add Repository Dialog (CloudStream parity)
  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.includes(' : ')) {
        const [name, url] = text.split(' : ');
        setNewRepoName(name.trim());
        setNewRepoUrl(url.trim());
      } else {
        setNewRepoUrl(text.trim());
      }
    } catch {
      // Clipboard access denied or empty
    }
  };

  // Delete Repository with confirmation
  const handleDeleteRepo = async (repo: RepositoryEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete repository "${repo.name}"?`)) {
      return;
    }
    try {
      await invoke('delete_repository', { url: repo.url });
      if (selectedRepo?.url === repo.url) {
        setSelectedRepo(null);
      }
      await loadRepositories();
      setMessage(`Removed repository "${repo.name}"`);
    } catch (e) {
      console.error('Failed to delete repository:', e);
      alert(`Error deleting repository: ${e}`);
    }
  };

  // Delete all repositories
  const handleDeleteAllRepos = async () => {
    if (repositories.length === 0) return;
    if (!window.confirm(`Are you sure you want to remove all ${repositories.length} repositories?`)) return;
    try {
      for (const r of repositories) {
        await invoke('delete_repository', { url: r.url });
      }
      setSelectedRepo(null);
      await loadRepositories();
      setMessage('All repositories removed.');
    } catch (e) {
      console.error('Failed to remove all repositories:', e);
      alert(`Error removing repositories: ${e}`);
    }
  };

  // Uninstall all installed extensions
  const handleUninstallAll = async () => {
    if (installedPlugins.length === 0) return;
    if (!window.confirm(`Are you sure you want to uninstall all ${installedPlugins.length} installed extensions?`)) return;
    try {
      for (const p of installedPlugins) {
        await invoke('delete_plugin', { name: p.name });
      }
      await loadInstalled();
      onExtensionsChanged?.();
      setMessage('All extensions uninstalled successfully.');
    } catch (e) {
      console.error('Failed to uninstall all extensions:', e);
      alert(`Error uninstalling extensions: ${e}`);
    }
  };

  // Sync all repositories in parallel
  const handleSyncAll = async () => {
    setSyncingAll(true);
    setMessage('Refreshing all repositories...');
    try {
      const updated: RepositoryEntry[] = await invoke('sync_repositories');
      setRepositories(updated);
      for (const r of updated) {
        await fetchRepoPlugins(r.url, true);
      }
      setMessage(`Successfully synced ${updated.length} repositories!`);
    } catch (e) {
      console.error('Sync all error:', e);
      setMessage(`Error syncing repositories: ${e}`);
    } finally {
      setSyncingAll(false);
    }
  };

  // Single Plugin Install
  const handleInstallPlugin = async (plugin: PluginManifest, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setInstallingId(plugin.id);
    try {
      await invoke('install_plugin', { manifest: plugin });
      await loadInstalled();
      onExtensionsChanged?.();
      setMessage(`Successfully installed "${plugin.name}" (.cs3)`);
    } catch (e) {
      console.error('Install plugin error:', e);
      alert(`Installation error: ${e}`);
    } finally {
      setInstallingId(null);
    }
  };

  // Single Plugin Delete / Uninstall
  const handleDeletePlugin = async (name: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!window.confirm(`Are you sure you want to uninstall "${name}"?`)) return;
    try {
      await invoke('delete_plugin', { name });
      await loadInstalled();
      onExtensionsChanged?.();
      setMessage(`Uninstalled extension "${name}"`);
    } catch (e) {
      console.error('Delete plugin error:', e);
      alert(`Uninstall failed: ${e}`);
    }
  };

  // Batch Download All in Current Repository
  const handleInstallAllInRepo = async (pluginsToInstall: PluginManifest[]) => {
    const uninstalled = pluginsToInstall.filter((p) => !isInstalled(p.name));
    if (uninstalled.length === 0) {
      alert('All extensions in this repository are already installed!');
      return;
    }
    if (!window.confirm(`Download and install ${uninstalled.length} extensions in parallel?`)) return;

    setInstallingAll(true);
    setInstallProgress({ current: 0, total: uninstalled.length });
    setMessage(`Downloading ${uninstalled.length} extensions...`);

    try {
      const count: number = await invoke('install_all_plugins', { plugins: uninstalled });
      await loadInstalled();
      onExtensionsChanged?.();
      setMessage(`Successfully installed ${count} extensions!`);
    } catch (e) {
      console.error('Install all error:', e);
      setMessage(`Batch install error: ${e}`);
    } finally {
      setInstallingAll(false);
      setInstallProgress(null);
    }
  };

  // Manual File / URL Install
  const handleInstallLocalFile = async () => {
    if (!localFilePath.trim()) return;
    try {
      await invoke('install_plugin_from_file', { filePath: localFilePath.trim() });
      await loadInstalled();
      onExtensionsChanged?.();
      setMessage(`Installed extension from: ${localFilePath}`);
      setShowManualModal(false);
      setLocalFilePath('');
    } catch (e) {
      alert(`Install from file failed: ${e}`);
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
      onExtensionsChanged?.();
      setMessage(`Installed custom extension "${name}"`);
      setShowManualModal(false);
      setDirectUrl('');
      setDirectName('');
    } catch (e) {
      alert(`Install failed: ${e}`);
    }
  };

  const isInstalled = (name: string) => {
    return installedPlugins.some((p) => p.name.toLowerCase() === name.toLowerCase());
  };

  // Open external URL safely
  const handleOpenExternal = async (url?: string) => {
    if (!url) return;
    try {
      await openUrl(url);
    } catch {
      window.open(url, '_blank');
    }
  };

  // Upvote / Community Rating handler
  const handleVote = (pluginName: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setVotesMap((prev) => {
      const current = prev[pluginName] || { count: Math.floor(Math.random() * 50) + 10, userVoted: false };
      const updated = {
        ...prev,
        [pluginName]: {
          count: current.userVoted ? current.count - 1 : current.count + 1,
          userVoted: !current.userVoted,
        },
      };
      try {
        localStorage.setItem('cloudstream_plugin_votes', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Calculate Storage Stats (Exact CloudStream pluginStorageAppbar parity)
  const allAvailablePlugins = useMemo(() => {
    const map = new Map<string, PluginManifest>();
    Object.values(repoPluginsMap).forEach((plugins) => {
      plugins.forEach((p) => {
        if (!map.has(p.name)) {
          map.set(p.name, p);
        }
      });
    });
    return Array.from(map.values());
  }, [repoPluginsMap]);

  const stats = useMemo(() => {
    const total = allAvailablePlugins.length;
    const downloaded = installedPlugins.length;
    // Plugins with status == 'down' or status == 0
    const disabled = allAvailablePlugins.filter((p) => p.status === 'down' || (p as any).status === 0).length;
    const notDownloaded = Math.max(0, total - downloaded);

    return {
      total: Math.max(total, downloaded),
      downloaded,
      disabled,
      notDownloaded,
      downloadedPercent: total > 0 ? (downloaded / total) * 100 : 0,
      disabledPercent: total > 0 ? (disabled / total) * 100 : 0,
      notDownloadedPercent: total > 0 ? (notDownloaded / total) * 100 : 100,
    };
  }, [allAvailablePlugins, installedPlugins]);

  // Plugins list for the currently selected repository
  const currentRepoPlugins = useMemo(() => {
    if (!selectedRepo) return [];
    return repoPluginsMap[selectedRepo.url] || [];
  }, [selectedRepo, repoPluginsMap]);

  // Filtered plugins in the current repository view
  const filteredRepoPlugins = useMemo(() => {
    return currentRepoPlugins.filter((p) => {
      const matchesSearch =
        !repoSearchQuery.trim() ||
        p.name.toLowerCase().includes(repoSearchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(repoSearchQuery.toLowerCase()) ||
        p.authors.some((a) => a.toLowerCase().includes(repoSearchQuery.toLowerCase()));

      const matchesType =
        activeTvType === 'All' || p.tv_types.some((t) => t.toLowerCase() === activeTvType.toLowerCase());

      const matchesLang =
        selectedLang === 'All' ||
        (selectedLang === 'Universal' && (!p.language || p.language === 'none')) ||
        (p.language && p.language.toLowerCase() === selectedLang.toLowerCase());

      return matchesSearch && matchesType && matchesLang;
    });
  }, [currentRepoPlugins, repoSearchQuery, activeTvType, selectedLang]);

  // Available languages inside the currently selected repository
  const availableLanguagesInRepo = useMemo(() => {
    const set = new Set<string>();
    currentRepoPlugins.forEach((p) => {
      if (p.language && p.language !== 'none') {
        set.add(p.language);
      }
    });
    return Array.from(set);
  }, [currentRepoPlugins]);

  // Global search across all repositories
  const globalSearchResults = useMemo(() => {
    if (!globalSearchQuery.trim()) return [];
    const query = globalSearchQuery.toLowerCase();
    return allAvailablePlugins.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.authors.some((a) => a.toLowerCase().includes(query))
    );
  }, [allAvailablePlugins, globalSearchQuery]);

  // Filtered installed plugins
  const filteredInstalledPlugins = useMemo(() => {
    if (!installedSearchQuery.trim()) return installedPlugins;
    const query = installedSearchQuery.toLowerCase();
    return installedPlugins.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
    );
  }, [installedPlugins, installedSearchQuery]);

  return (
    <div style={{ padding: '36px 50px 80px', maxWidth: '1360px', margin: '0 auto', color: '#fff' }}>
      {/* Top Breadcrumb when inspecting a specific repository */}
      {selectedRepo && (
        <button
          onClick={() => setSelectedRepo(null)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: 'none',
            color: '#c7d2fe',
            padding: '8px 16px',
            borderRadius: '9999px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
            marginBottom: '20px',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(124, 58, 237, 0.2)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
        >
          <ArrowLeft size={16} />
          Back to All Repositories
        </button>
      )}

      {/* Main Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Puzzle size={32} color="var(--primary)" />
            {selectedRepo ? selectedRepo.name : 'Extension & Repository Manager'}
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '6px' }}>
            {selectedRepo
              ? `Browsing ${currentRepoPlugins.length} CloudStream .cs3 extensions from this repository.`
              : 'Add, update, and manage modular CloudStream repositories and local providers.'}
          </p>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="btn-secondary"
            onClick={() => setShowManualModal(true)}
            style={{ padding: '9px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '9999px' }}
          >
            <FolderOpen size={16} color="var(--accent-cyan)" />
            Install File / URL
          </button>

          {!selectedRepo && (
            <button
              className="btn-primary"
              onClick={() => setShowAddRepoModal(true)}
              style={{ padding: '9px 18px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '9999px' }}
            >
              <Plus size={16} />
              Add Repository
            </button>
          )}

          <button
            onClick={handleSyncAll}
            disabled={syncingAll}
            title="Sync all repositories"
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              padding: '10px',
              borderRadius: '9999px',
              color: '#c7d2fe',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
          >
            <RefreshCw size={16} className={syncingAll ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* CloudStream Storage & Extensions Stats Bar (Exact pluginStorageAppbar parity) */}
      <div
        onClick={() => {
          setSelectedRepo(null);
          setActiveTab('installed');
        }}
        style={{
          background: 'rgba(255, 255, 255, 0.035)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '16px',
          padding: '18px 24px',
          marginBottom: '28px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.055)';
          e.currentTarget.style.borderColor = 'rgba(157, 114, 255, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.035)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: '#e2e8f0' }}>
            <HardDrive size={17} color="var(--stremio-purple-light)" />
            Extension Storage & Repository Breakdown
          </div>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>
            Total: {stats.total} Extensions Available Across Repositories
          </span>
        </div>

        {/* Proportional 3-Color Bar */}
        <div
          style={{
            height: '10px',
            width: '100%',
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '9999px',
            overflow: 'hidden',
            display: 'flex',
            marginBottom: '12px',
          }}
        >
          {stats.downloaded > 0 && (
            <div
              style={{
                width: `${stats.downloadedPercent}%`,
                background: 'var(--accent-emerald)',
                transition: 'width 0.3s ease',
              }}
              title={`Downloaded: ${stats.downloaded}`}
            />
          )}
          {stats.disabled > 0 && (
            <div
              style={{
                width: `${stats.disabledPercent}%`,
                background: 'var(--accent-amber)',
                transition: 'width 0.3s ease',
              }}
              title={`Disabled: ${stats.disabled}`}
            />
          )}
          {stats.notDownloaded > 0 && (
            <div
              style={{
                width: `${stats.notDownloadedPercent}%`,
                background: 'rgba(124, 58, 237, 0.5)',
                transition: 'width 0.3s ease',
              }}
              title={`Available: ${stats.notDownloaded}`}
            />
          )}
        </div>

        {/* Stat Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap', fontSize: '12px', fontWeight: 600 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6ee7b7' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-emerald)' }} />
            Downloaded: {stats.downloaded}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fcd34d' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-amber)' }} />
            Disabled / Down: {stats.disabled}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#c7d2fe' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--stremio-purple-light)' }} />
            Not Downloaded: {stats.notDownloaded}
          </div>
          <div style={{ marginLeft: 'auto', color: 'var(--stremio-purple-light)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Click to manage installed extensions &rarr;
          </div>
        </div>
      </div>

      {/* Notifications / Feedback Bar */}
      {(message || copyFeedback) && (
        <div
          style={{
            padding: '12px 18px',
            background: 'rgba(124, 58, 237, 0.15)',
            border: '1px solid rgba(124, 58, 237, 0.3)',
            borderRadius: '12px',
            color: '#c7d2fe',
            fontSize: '13px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={16} color="var(--accent-cyan)" />
            {copyFeedback || message}
          </div>
          <button
            onClick={() => {
              setMessage(null);
              setCopyFeedback(null);
            }}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main Tabs (only shown when not inspecting a single repository) */}
      {!selectedRepo && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '14px' }}>
          <button
            onClick={() => setActiveTab('repositories')}
            style={{
              padding: '8px 20px',
              borderRadius: '9999px',
              border: 'none',
              background: activeTab === 'repositories' ? 'var(--stremio-purple)' : 'rgba(255, 255, 255, 0.05)',
              color: activeTab === 'repositories' ? '#fff' : '#94a3b8',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <Server size={15} />
            Repositories ({repositories.length})
          </button>

          <button
            onClick={() => setActiveTab('installed')}
            style={{
              padding: '8px 20px',
              borderRadius: '9999px',
              border: 'none',
              background: activeTab === 'installed' ? 'var(--stremio-purple)' : 'rgba(255, 255, 255, 0.05)',
              color: activeTab === 'installed' ? '#fff' : '#94a3b8',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <CheckCircle size={15} color={activeTab === 'installed' ? '#6ee7b7' : '#94a3b8'} />
            Installed Extensions ({installedPlugins.length})
          </button>
        </div>
      )}

      {/* =========================================================================
          VIEW 1: REPOSITORIES OVERVIEW TAB
          ========================================================================= */}
      {!selectedRepo && activeTab === 'repositories' && (
        <div>
          {/* Global Search Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'rgba(255, 255, 255, 0.055)',
              padding: '10px 18px',
              borderRadius: '9999px',
              marginBottom: '24px',
            }}
          >
            <Search size={18} color="#8e8aa4" />
            <input
              type="text"
              placeholder="Search across all extensions and repositories..."
              value={globalSearchQuery}
              onChange={(e) => setGlobalSearchQuery(e.target.value)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#fff',
                fontSize: '14px',
                fontFamily: 'var(--font-body)',
              }}
            />
            {globalSearchQuery && (
              <button
                onClick={() => setGlobalSearchQuery('')}
                style={{ background: 'transparent', border: 'none', color: '#8e8aa4', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* If Global Search Active: Show Global Results Grid */}
          {globalSearchQuery.trim().length > 0 ? (
            <div style={{ marginBottom: '40px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: '#fff' }}>
                Search Results ({globalSearchResults.length})
              </h2>
              {globalSearchResults.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', color: '#94a3b8' }}>
                  No extensions found matching "{globalSearchQuery}"
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                  {globalSearchResults.map((plugin) => (
                    <ExtensionCard
                      key={plugin.id}
                      plugin={plugin}
                      isInstalled={isInstalled(plugin.name)}
                      onInstall={handleInstallPlugin}
                      onDelete={handleDeletePlugin}
                      onSelectExtension={onSelectExtension}
                      onOpenDetail={() => setDetailPlugin(plugin)}
                      onVote={(e) => handleVote(plugin.name, e)}
                      votes={votesMap[plugin.name]}
                      installing={installingId === plugin.id}
                      formatFileSize={formatFileSize}
                      getLanguageInfo={getLanguageInfo}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Otherwise: Show Repositories Cards Grid */
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Server size={18} color="var(--primary)" />
                  Added Repositories ({repositories.length})
                  {loadingRepos && <RefreshCw size={14} className="animate-spin" color="#8e8aa4" />}
                </h2>

                {repositories.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDeleteAllRepos}
                    title="Remove all repositories"
                    style={{
                      background: 'rgba(244, 63, 94, 0.12)',
                      border: '1px solid rgba(244, 63, 94, 0.25)',
                      color: '#fb7185',
                      padding: '6px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Trash2 size={13} />
                    <span>Clean All Repos</span>
                  </button>
                )}
              </div>

              {repositories.length === 0 && (
                <div
                  style={{
                    padding: '36px 24px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '16px',
                    border: '1px dashed rgba(255, 255, 255, 0.1)',
                    textAlign: 'center',
                    marginBottom: '32px',
                  }}
                >
                  <Server size={36} color="var(--stremio-purple-light)" style={{ marginBottom: '12px', opacity: 0.8 }} />
                  <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
                    No Repositories Added
                  </h3>
                  <p style={{ fontSize: '13px', color: '#94a3b8', maxWidth: '440px', margin: '0 auto 16px', lineHeight: '1.5' }}>
                    You have cleaned up all repositories. Add your fresh repository URL above, install extensions directly from a local .cs3 file, or pick from the community repositories below.
                  </p>
                  <button
                    className="btn-primary"
                    onClick={() => setShowAddRepoModal(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 18px', fontSize: '13px' }}
                  >
                    <Plus size={15} />
                    Add Repository
                  </button>
                </div>
              )}

              {repositories.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '18px', marginBottom: '40px' }}>
                {repositories.map((repo) => {
                  const pluginsInRepo = repoPluginsMap[repo.url] || [];
                  return (
                    <div
                      key={repo.url}
                      onClick={() => setSelectedRepo(repo)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '16px',
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.065)';
                        e.currentTarget.style.borderColor = 'rgba(157, 114, 255, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div
                              style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '10px',
                                background: 'rgba(124, 58, 237, 0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--stremio-purple-light)',
                              }}
                            >
                              <Globe size={22} />
                            </div>
                            <div>
                              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
                                {repo.name}
                              </h3>
                              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                                {pluginsInRepo.length > 0
                                  ? `${pluginsInRepo.length} extensions available`
                                  : repo.plugin_count > 0
                                  ? `${repo.plugin_count} extensions`
                                  : 'Click to view extensions'}
                              </span>
                            </div>
                          </div>

                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#6ee7b7',
                              padding: '2px 8px',
                              borderRadius: '9999px',
                            }}
                          >
                            ONLINE
                          </span>
                        </div>

                        <p
                          style={{
                            fontSize: '12px',
                            color: '#8e8aa4',
                            fontFamily: 'monospace',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            background: 'rgba(0, 0, 0, 0.2)',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            marginBottom: '16px',
                          }}
                        >
                          {repo.url}
                        </p>
                      </div>

                      {/* Card Actions */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                          paddingTop: '12px',
                        }}
                      >
                        <button
                          className="btn-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRepo(repo);
                          }}
                          style={{ padding: '6px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Layers size={14} />
                          Browse Extensions
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={(e) => handleCopyShareLink(repo, e)}
                            title="Copy shareable link (<name> : <url>)"
                            style={{
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: 'none',
                              color: '#c7d2fe',
                              padding: '7px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                            }}
                          >
                            <Copy size={15} />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDeleteRepo(repo, e)}
                            title="Delete repository"
                            style={{
                              background: 'rgba(244, 63, 94, 0.15)',
                              border: 'none',
                              color: '#f43f5e',
                              padding: '7px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}

              {/* Recommended Community Preset Repositories */}
              <div style={{ marginTop: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#e2e8f0', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={16} color="var(--accent-cyan)" />
                  Explore Community CloudStream Repositories
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
                  {PRESET_REPOSITORIES.map((preset) => {
                    const isAdded = repositories.some((r) => r.url.toLowerCase() === preset.url.toLowerCase());
                    return (
                      <div
                        key={preset.url}
                        style={{
                          padding: '16px',
                          background: 'rgba(255, 255, 255, 0.025)',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          borderRadius: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '14px', color: '#fff', marginBottom: '4px' }}>
                            {preset.name}
                          </div>
                          <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: '1.4', marginBottom: '12px' }}>
                            {preset.description}
                          </p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          {isAdded ? (
                            <span style={{ fontSize: '12px', color: '#6ee7b7', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <CheckCircle size={14} /> Added to Library
                            </span>
                          ) : (
                            <button
                              className="btn-secondary"
                              onClick={() => handleAddRepo(preset.url, preset.name)}
                              disabled={isAddingRepo}
                              style={{ padding: '5px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                              <Plus size={14} /> Add Repository
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          VIEW 2: SPECIFIC REPOSITORY VIEW (PluginsFragment Parity)
          ========================================================================= */}
      {selectedRepo && (
        <div>
          {/* Repository Header Banner */}
          <div
            style={{
              padding: '24px',
              background: 'rgba(124, 58, 237, 0.08)',
              border: '1px solid rgba(124, 58, 237, 0.2)',
              borderRadius: '16px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Globe size={24} color="var(--stremio-purple-light)" />
                <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#fff' }}>{selectedRepo.name}</h2>
              </div>
              <p style={{ fontSize: '12px', color: '#c7d2fe', fontFamily: 'monospace', marginTop: '6px' }}>
                {selectedRepo.url}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                className="btn-secondary"
                onClick={() => fetchRepoPlugins(selectedRepo.url, true)}
                disabled={loadingPlugins}
                style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={14} className={loadingPlugins ? 'animate-spin' : ''} />
                Refresh Repo
              </button>

              <button
                className="btn-primary"
                onClick={() => handleInstallAllInRepo(currentRepoPlugins)}
                disabled={installingAll || currentRepoPlugins.length === 0}
                style={{ padding: '8px 18px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <CheckCheck size={16} />
                {installingAll
                  ? `Installing (${installProgress?.current || 0}/${installProgress?.total || 0})...`
                  : 'Install All Extensions'}
              </button>
            </div>
          </div>

          {/* Filtering & Search Toolbar */}
          <div style={{ marginBottom: '20px' }}>
            {/* Search + Language Filter Row */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <div
                style={{
                  flex: 1,
                  minWidth: '240px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: 'rgba(255, 255, 255, 0.055)',
                  padding: '8px 16px',
                  borderRadius: '9999px',
                }}
              >
                <Search size={16} color="#8e8aa4" />
                <input
                  type="text"
                  placeholder={`Search ${selectedRepo.name} extensions...`}
                  value={repoSearchQuery}
                  onChange={(e) => setRepoSearchQuery(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#fff',
                    fontSize: '13px',
                  }}
                />
                {repoSearchQuery && (
                  <button
                    onClick={() => setRepoSearchQuery('')}
                    style={{ background: 'transparent', border: 'none', color: '#8e8aa4', cursor: 'pointer' }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Language Filter Dropdown */}
              {availableLanguagesInRepo.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Globe size={15} color="#8e8aa4" />
                  <select
                    value={selectedLang}
                    onChange={(e) => setSelectedLang(e.target.value)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#fff',
                      padding: '8px 14px',
                      borderRadius: '9999px',
                      fontSize: '13px',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="All" style={{ background: '#141228' }}>🌐 All Languages</option>
                    <option value="Universal" style={{ background: '#141228' }}>🌐 Universal / Multi</option>
                    {availableLanguagesInRepo.map((lang) => {
                      const info = getLanguageInfo(lang);
                      return (
                        <option key={lang} value={lang} style={{ background: '#141228' }}>
                          {info.flag} {info.name} ({lang})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>

            {/* TV Types Filter Chips (CloudStream parity) */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              {TV_TYPES_LIST.map((type) => {
                const active = activeTvType === type;
                return (
                  <button
                    key={type}
                    onClick={() => setActiveTvType(type)}
                    style={{
                      padding: '5px 14px',
                      borderRadius: '9999px',
                      border: 'none',
                      background: active ? 'rgba(124, 58, 237, 0.4)' : 'rgba(255, 255, 255, 0.05)',
                      color: active ? '#fff' : '#8e8aa4',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Results Count */}
          <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '16px', fontWeight: 600 }}>
            Showing {filteredRepoPlugins.length} of {currentRepoPlugins.length} extensions
          </div>

          {/* Extensions Grid */}
          {filteredRepoPlugins.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '14px', color: '#94a3b8' }}>
              No extensions match your filter criteria.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '18px' }}>
              {filteredRepoPlugins.map((plugin) => (
                <ExtensionCard
                  key={plugin.id}
                  plugin={plugin}
                  isInstalled={isInstalled(plugin.name)}
                  onInstall={handleInstallPlugin}
                  onDelete={handleDeletePlugin}
                  onSelectExtension={onSelectExtension}
                  onOpenDetail={() => setDetailPlugin(plugin)}
                  onVote={(e) => handleVote(plugin.name, e)}
                  votes={votesMap[plugin.name]}
                  installing={installingId === plugin.id}
                  formatFileSize={formatFileSize}
                  getLanguageInfo={getLanguageInfo}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          VIEW 3: INSTALLED EXTENSIONS MANAGER TAB (isLocal: true parity)
          ========================================================================= */}
      {!selectedRepo && activeTab === 'installed' && (
        <div>
          {/* Search Installed Extensions & Action Row */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '24px' }}>
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: 'rgba(255, 255, 255, 0.055)',
                padding: '10px 18px',
                borderRadius: '9999px',
              }}
            >
              <Search size={18} color="#8e8aa4" />
              <input
                type="text"
                placeholder="Filter installed extensions..."
                value={installedSearchQuery}
                onChange={(e) => setInstalledSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#fff',
                  fontSize: '14px',
                }}
              />
              {installedSearchQuery && (
                <button
                  onClick={() => setInstalledSearchQuery('')}
                  style={{ background: 'transparent', border: 'none', color: '#8e8aa4', cursor: 'pointer' }}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {installedPlugins.length > 0 && (
              <button
                type="button"
                onClick={handleUninstallAll}
                title="Uninstall all extensions"
                style={{
                  background: 'rgba(244, 63, 94, 0.12)',
                  border: '1px solid rgba(244, 63, 94, 0.25)',
                  color: '#fb7185',
                  padding: '10px 18px',
                  borderRadius: '9999px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                }}
              >
                <Trash2 size={15} />
                <span>Uninstall All ({installedPlugins.length})</span>
              </button>
            )}
          </div>

          {filteredInstalledPlugins.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', color: '#94a3b8' }}>
              <Puzzle size={36} color="var(--stremio-icon-muted)" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
                No Extensions Installed Yet
              </div>
              <p style={{ fontSize: '13px', marginBottom: '20px' }}>
                Browse available repositories to install domestic and international streaming extensions.
              </p>
              <button
                className="btn-primary"
                onClick={() => setActiveTab('repositories')}
                style={{ padding: '8px 20px', fontSize: '13px' }}
              >
                Browse Repositories
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
              {filteredInstalledPlugins.map((plugin) => {
                const fileSize = formatFileSize(plugin.file_size);
                return (
                  <div
                    key={plugin.id}
                    onClick={() => setDetailPlugin(plugin)}
                    style={{
                      padding: '18px 20px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.065)';
                      e.currentTarget.style.borderColor = 'rgba(157, 114, 255, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {plugin.icon_url ? (
                            <img
                              src={plugin.icon_url}
                              alt={plugin.name}
                              style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'contain' }}
                              onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                          ) : (
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                background: 'rgba(124, 58, 237, 0.25)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--stremio-purple-light)',
                              }}
                            >
                              <Puzzle size={16} />
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '15px', color: '#fff' }}>{plugin.name}</div>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>v{plugin.version}</span>
                          </div>
                        </div>

                        <span
                          style={{
                            fontSize: '10px',
                            background: 'rgba(16, 185, 129, 0.2)',
                            color: '#6ee7b7',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontWeight: 700,
                          }}
                        >
                          ACTIVE
                        </span>
                      </div>

                      {fileSize && (
                        <div style={{ fontSize: '11px', color: '#8e8aa4', marginBottom: '12px' }}>
                          Size on disk: {fileSize}
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: '12px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                      }}
                    >
                      {onSelectExtension && (
                        <button
                          className="btn-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectExtension(plugin.name);
                          }}
                          style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                          title="Set as active feed provider"
                        >
                          <Globe size={13} />
                          Browse
                        </button>
                      )}

                      <button
                        onClick={(e) => handleDeletePlugin(plugin.name, e)}
                        style={{
                          background: 'rgba(244, 63, 94, 0.15)',
                          color: '#f43f5e',
                          border: 'none',
                          padding: '7px 10px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                        title="Uninstall extension"
                      >
                        <Trash2 size={14} />
                        Uninstall
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          MODAL 1: ADD REPOSITORY DIALOG (add_repo_input.xml Parity)
          ========================================================================= */}
      {showAddRepoModal && (
        <div className="modal-backdrop" onClick={() => setShowAddRepoModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px', padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Server size={20} color="var(--primary)" />
                Add CloudStream Repository
              </h2>
              <button
                onClick={() => setShowAddRepoModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '20px', lineHeight: '1.5' }}>
              Enter a repository manifest URL (e.g. raw GitHub URL, <code style={{ color: 'var(--accent-cyan)' }}>cloudstreamrepo://</code>, or shortlink <code style={{ color: 'var(--accent-cyan)' }}>!shortcode</code>).
            </p>

            {/* Quick Presets */}
            <div style={{ marginBottom: '18px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#8e8aa4', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
                Quick Presets:
              </span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {PRESET_REPOSITORIES.map((preset) => (
                  <button
                    key={preset.url}
                    type="button"
                    onClick={() => {
                      setNewRepoName(preset.name);
                      setNewRepoUrl(preset.url);
                    }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '9999px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      color: '#c7d2fe',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    {preset.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: '6px' }}>
                  Repository Name (Optional):
                </label>
                <input
                  type="text"
                  placeholder="e.g. Hexated Providers"
                  value={newRepoName}
                  onChange={(e) => setNewRepoName(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#e2e8f0' }}>
                    Repository URL:
                  </label>
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--stremio-purple-light)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Share2 size={12} />
                    Paste & Auto-detect
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="https://raw.githubusercontent.com/.../repo.json"
                  value={newRepoUrl}
                  onChange={(e) => setNewRepoUrl(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: '13px',
                    outline: 'none',
                    fontFamily: 'monospace',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn-secondary" onClick={() => setShowAddRepoModal(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={() => handleAddRepo()}
                disabled={isAddingRepo || !newRepoUrl.trim()}
                style={{ padding: '9px 20px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {isAddingRepo ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={15} />}
                {isAddingRepo ? 'Verifying & Adding...' : 'Add Repository'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: PLUGIN DETAILS MODAL (PluginDetailsFragment Parity)
          ========================================================================= */}
      {detailPlugin && (
        <div className="modal-backdrop" onClick={() => setDetailPlugin(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '640px', padding: '32px', borderRadius: '20px' }}
          >
            {/* Header with Icon, Name & Status */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {detailPlugin.icon_url ? (
                  <img
                    src={detailPlugin.icon_url}
                    alt={detailPlugin.name}
                    style={{ width: '56px', height: '56px', borderRadius: '12px', objectFit: 'contain' }}
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                ) : (
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '12px',
                      background: 'rgba(124, 58, 237, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--stremio-purple-light)',
                    }}
                  >
                    <Puzzle size={28} />
                  </div>
                )}
                <div>
                  <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                    {detailPlugin.name}
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--stremio-purple-light)', fontWeight: 700 }}>
                      v{detailPlugin.version}
                    </span>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>•</span>
                    <span
                      style={{
                        fontSize: '11px',
                        background: detailPlugin.status === 'down' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                        color: detailPlugin.status === 'down' ? '#fca5a5' : '#6ee7b7',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontWeight: 700,
                      }}
                    >
                      {detailPlugin.status === 'down' ? 'STATUS: DOWN' : 'STATUS: OPERATIONAL'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setDetailPlugin(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Metadata Badges Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px',
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '16px',
                borderRadius: '12px',
                marginBottom: '20px',
              }}
            >
              <div>
                <span style={{ fontSize: '11px', color: '#8e8aa4', display: 'block', marginBottom: '2px' }}>Authors</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                  {detailPlugin.authors.length > 0 ? detailPlugin.authors.join(', ') : 'Community'}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#8e8aa4', display: 'block', marginBottom: '2px' }}>Language</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                  {getLanguageInfo(detailPlugin.language).flag} {getLanguageInfo(detailPlugin.language).name}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#8e8aa4', display: 'block', marginBottom: '2px' }}>Download Size</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                  {formatFileSize(detailPlugin.file_size) || 'Standard (.cs3)'}
                </span>
              </div>
            </div>

            {/* Categories */}
            {detailPlugin.tv_types.length > 0 && (
              <div style={{ marginBottom: '18px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#8e8aa4', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Supported Categories:
                </span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {detailPlugin.tv_types.map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: '11px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        color: '#c7d2fe',
                        padding: '3px 10px',
                        borderRadius: '9999px',
                        fontWeight: 600,
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            <div style={{ marginBottom: '24px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#8e8aa4', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                Description:
              </span>
              <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.6' }}>
                {detailPlugin.description || 'CloudStream provider plugin with media scraping, link extraction, and metadata support.'}
              </p>
            </div>

            {/* Repository Link & Community Upvote */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '14px 18px',
                borderRadius: '12px',
                marginBottom: '24px',
              }}
            >
              {detailPlugin.repository_url ? (
                <button
                  type="button"
                  onClick={() => handleOpenExternal(detailPlugin.repository_url)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--accent-cyan)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <ExternalLink size={15} />
                  View Source Repository
                </button>
              ) : (
                <span style={{ fontSize: '12px', color: '#64748b' }}>CloudStream Modular Plugin</span>
              )}

              {/* Voting Button (VotingApi parity) */}
              <button
                type="button"
                onClick={() => handleVote(detailPlugin.name)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: votesMap[detailPlugin.name]?.userVoted ? 'rgba(124, 58, 237, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: votesMap[detailPlugin.name]?.userVoted ? 'var(--stremio-purple-light)' : '#c7d2fe',
                  padding: '6px 14px',
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 700,
                  transition: 'all 0.15s ease',
                }}
              >
                <ThumbsUp size={14} fill={votesMap[detailPlugin.name]?.userVoted ? 'var(--stremio-purple-light)' : 'none'} />
                {votesMap[detailPlugin.name]?.count || 24} Upvotes
              </button>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '20px' }}>
              {isInstalled(detailPlugin.name) ? (
                <div style={{ display: 'flex', gap: '10px' }}>
                  {onSelectExtension && (
                    <button
                      className="btn-primary"
                      onClick={() => {
                        onSelectExtension(detailPlugin.name);
                        setDetailPlugin(null);
                      }}
                      style={{ padding: '8px 18px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Globe size={14} />
                      Browse on Home
                    </button>
                  )}
                  <button
                    onClick={() => {
                      handleDeletePlugin(detailPlugin.name);
                      setDetailPlugin(null);
                    }}
                    style={{
                      background: 'rgba(244, 63, 94, 0.15)',
                      color: '#f43f5e',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Trash2 size={14} />
                    Uninstall
                  </button>
                </div>
              ) : (
                <button
                  className="btn-primary"
                  onClick={() => handleInstallPlugin(detailPlugin)}
                  disabled={installingId === detailPlugin.id}
                  style={{ padding: '9px 24px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Download size={15} />
                  {installingId === detailPlugin.id ? 'Installing (.cs3)...' : 'Install Extension'}
                </button>
              )}

              <button className="btn-secondary" onClick={() => setDetailPlugin(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: MANUAL INSTALL FROM FILE / URL
          ========================================================================= */}
      {showManualModal && (
        <div className="modal-backdrop" onClick={() => setShowManualModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px', padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FolderOpen size={20} color="var(--primary)" />
                Install Custom Extension
              </h2>
              <button
                onClick={() => setShowManualModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Option 1: Local File */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FolderOpen size={15} color="var(--accent-cyan)" />
                Option 1: Install from Local Path (.cs3 / .jar)
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
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
                <button className="btn-primary" onClick={handleInstallLocalFile} style={{ padding: '8px 18px', fontSize: '13px' }}>
                  Install File
                </button>
              </div>
            </div>

            {/* Option 2: Direct URL */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Link size={15} color="var(--primary)" />
                Option 2: Install from Direct Download URL (.cs3 / .jar)
              </div>
              <input
                type="text"
                placeholder="Extension Name (e.g. CineplexBD)"
                value={directName}
                onChange={(e) => setDirectName(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  color: '#fff',
                  fontSize: '13px',
                  marginBottom: '10px',
                  outline: 'none',
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
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
                <button className="btn-primary" onClick={handleInstallDirectUrl} style={{ padding: '8px 18px', fontSize: '13px' }}>
                  Install URL
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
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

// Reusable Extension Card Component
interface ExtensionCardProps {
  plugin: PluginManifest;
  isInstalled: boolean;
  onInstall: (plugin: PluginManifest, e?: React.MouseEvent) => void;
  onDelete: (name: string, e?: React.MouseEvent) => void;
  onSelectExtension?: (name: string) => void;
  onOpenDetail: () => void;
  onVote: (e: React.MouseEvent) => void;
  votes?: { count: number; userVoted: boolean };
  installing: boolean;
  formatFileSize: (bytes?: number) => string | null;
  getLanguageInfo: (lang?: string) => { name: string; flag: string };
}

const ExtensionCard: React.FC<ExtensionCardProps> = ({
  plugin,
  isInstalled,
  onInstall,
  onDelete,
  onSelectExtension,
  onOpenDetail,
  onVote,
  votes,
  installing,
  formatFileSize,
  getLanguageInfo,
}) => {
  const langInfo = getLanguageInfo(plugin.language);
  const fileSize = formatFileSize(plugin.file_size);

  return (
    <div
      onClick={onOpenDetail}
      style={{
        padding: '18px 20px',
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.065)';
        e.currentTarget.style.borderColor = 'rgba(157, 114, 255, 0.35)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
      }}
    >
      <div>
        {/* Header: Icon, Title, Version & Status */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {plugin.icon_url ? (
              <img
                src={plugin.icon_url}
                alt={plugin.name}
                style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'contain' }}
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            ) : (
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(124, 58, 237, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--stremio-purple-light)',
                }}
              >
                <Puzzle size={16} />
              </div>
            )}
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#fff', lineHeight: 1.2 }}>{plugin.name}</div>
              <span style={{ fontSize: '11px', color: '#8e8aa4', fontWeight: 600 }}>v{plugin.version}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isInstalled ? (
              <span
                style={{
                  fontSize: '10px',
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#6ee7b7',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Check size={11} /> INSTALLED
              </span>
            ) : plugin.status === 'down' ? (
              <span
                style={{
                  fontSize: '10px',
                  background: 'rgba(239, 68, 68, 0.2)',
                  color: '#fca5a5',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  fontWeight: 700,
                }}
              >
                DOWN
              </span>
            ) : null}
          </div>
        </div>

        {/* Category & Language Badges */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#c7d2fe',
              padding: '2px 8px',
              borderRadius: '9999px',
            }}
          >
            {langInfo.flag} {langInfo.name}
          </span>

          {fileSize && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#94a3b8',
                padding: '2px 8px',
                borderRadius: '9999px',
              }}
            >
              {fileSize}
            </span>
          )}

          {plugin.tv_types.slice(0, 2).map((t) => (
            <span
              key={t}
              style={{
                fontSize: '10px',
                fontWeight: 600,
                background: 'rgba(124, 58, 237, 0.15)',
                color: 'var(--stremio-purple-light)',
                padding: '2px 8px',
                borderRadius: '9999px',
              }}
            >
              {t}
            </span>
          ))}
        </div>

        {/* Description snippet */}
        <p
          style={{
            fontSize: '12px',
            color: '#94a3b8',
            lineHeight: '1.4',
            marginBottom: '14px',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {plugin.description || 'CloudStream provider plugin with media scraping and stream extraction.'}
        </p>
      </div>

      {/* Footer Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '12px',
          borderTop: '1px solid rgba(255, 255, 255, 0.04)',
        }}
      >
        <button
          type="button"
          onClick={onVote}
          style={{
            background: 'transparent',
            border: 'none',
            color: votes?.userVoted ? 'var(--stremio-purple-light)' : '#8e8aa4',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
          title="Upvote extension"
        >
          <ThumbsUp size={12} fill={votes?.userVoted ? 'var(--stremio-purple-light)' : 'none'} />
          {votes?.count || 12}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isInstalled ? (
            <>
              {onSelectExtension && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectExtension(plugin.name);
                  }}
                  style={{ padding: '5px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  title="Browse extension on Home"
                >
                  <Globe size={12} />
                  Browse
                </button>
              )}
              <button
                type="button"
                onClick={(e) => onDelete(plugin.name, e)}
                style={{
                  background: 'rgba(244, 63, 94, 0.15)',
                  color: '#f43f5e',
                  border: 'none',
                  padding: '6px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
                title="Uninstall extension"
              >
                <Trash2 size={13} />
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={(e) => onInstall(plugin, e)}
              disabled={installing}
              style={{ padding: '5px 14px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <Download size={13} />
              {installing ? 'Installing...' : 'Install'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
