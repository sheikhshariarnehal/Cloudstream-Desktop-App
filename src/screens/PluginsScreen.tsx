import React, { useEffect, useState, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { PluginManifest, RepositoryEntry, RepositoryManifest } from '../types';
import { getLanguageMetadata } from '../utils/subtitleHelper';
import {
  ALL_CLOUDSTREAM_REPOSITORIES,
} from '../data/cloudstreamRepositories';
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
  Compass,
  MessageSquare,
} from 'lucide-react';

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

const REPO_CATEGORIES = [
  { id: 'all', label: 'All Repositories' },
  { id: 'official', label: 'Official' },
  { id: 'bdix', label: 'BDIX & Bangladesh' },
  { id: 'hindi', label: 'Hindi & Indian' },
  { id: 'anime', label: 'Anime & Manga' },
  { id: 'multilang', label: 'Multi-language' },
  { id: 'english', label: 'English / Global' },
  { id: 'italian', label: 'Italian' },
  { id: 'french', label: 'French' },
  { id: 'german', label: 'German' },
  { id: 'turkish', label: 'Turkish' },
  { id: 'indonesian', label: 'Indonesian' },
  { id: 'arabic', label: 'Arabic' },
  { id: 'ukrainian', label: 'Ukrainian' },
  { id: 'brazilian', label: 'Portuguese / Brazil' },
  { id: 'iptv', label: 'Live TV & IPTV' },
];

type NavigationSection = 'discover' | 'installed' | 'repositories' | 'manual';

interface PluginsScreenProps {
  onExtensionsChanged?: () => void;
  onSelectExtension?: (extName: string) => void;
}

export const PluginsScreen: React.FC<PluginsScreenProps> = ({ onExtensionsChanged, onSelectExtension }) => {
  // Main sidebar navigation section
  const [navSection, setNavSection] = useState<NavigationSection>('discover');

  // Discovery Sub-View: 'repos' (all available repos to add) | 'extensions' (all available provider plugins)
  const [discoverTab, setDiscoverTab] = useState<'repos' | 'extensions'>('repos');

  // Currently inspected repository for detailed browsing
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
  const [repoCatalogSearch, setRepoCatalogSearch] = useState('');
  const [repoCatalogCategory, setRepoCatalogCategory] = useState('all');
  const [expandedRepoPlugins, setExpandedRepoPlugins] = useState<Record<string, boolean>>({});

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

  const [directUrl, setDirectUrl] = useState('');
  const [directName, setDirectName] = useState('');
  const [localFilePath, setLocalFilePath] = useState('');

  // Plugin Details Modal
  const [detailPlugin, setDetailPlugin] = useState<PluginManifest | null>(null);

  // Community votes tracking
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
  const handleCopyShareLink = (repo: { name: string; url: string }, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const shareText = `${repo.name} : ${repo.url}`;
    navigator.clipboard.writeText(shareText);
    setCopyFeedback(`Copied "${repo.name}" link to clipboard!`);
    setTimeout(() => setCopyFeedback(null), 3000);
  };

  // Copy plain text / shortcode
  const handleCopyText = (text: string, label?: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopyFeedback(label || `Copied "${text}" to clipboard!`);
    setTimeout(() => setCopyFeedback(null), 3000);
  };

  // Add Repository with Shortcode / URL auto-resolution
  const handleAddRepo = async (overrideUrl?: string, overrideName?: string) => {
    let inputUrl = (overrideUrl || newRepoUrl).trim();
    if (!inputUrl) return;
    let inputName = (overrideName || newRepoName).trim() || undefined;

    // Check if input is a shortcode from curated repositories
    const matchedByShortcode = ALL_CLOUDSTREAM_REPOSITORIES.find(
      (r) =>
        r.id.toLowerCase() === inputUrl.toLowerCase() ||
        r.shortcodes?.some((s) => s.toLowerCase() === inputUrl.toLowerCase()) ||
        r.name.toLowerCase() === inputUrl.toLowerCase()
    );

    if (matchedByShortcode) {
      inputUrl = matchedByShortcode.directInstall;
      if (!inputName) {
        inputName = matchedByShortcode.name;
      }
    }

    setIsAddingRepo(true);
    setMessage(null);
    try {
      const entry: RepositoryEntry = await invoke('add_repository', {
        url: inputUrl,
        name: inputName,
      });
      await loadRepositories();
      await fetchRepoPlugins(entry.url, true);
      setMessage(`Successfully added repository "${entry.name}"`);
      setShowAddRepoModal(false);
      setNewRepoUrl('');
      setNewRepoName('');
      onExtensionsChanged?.();
    } catch (e) {
      console.error('Failed to add repository:', e);
      alert(`Could not add repository: ${e}`);
    } finally {
      setIsAddingRepo(false);
    }
  };

  // Smart Clipboard Paste for Add Repository Dialog
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
      onExtensionsChanged?.();
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
      onExtensionsChanged?.();
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
      onExtensionsChanged?.();
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
      setLocalFilePath('');
      setNavSection('installed');
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
      setDirectUrl('');
      setDirectName('');
      setNavSection('installed');
    } catch (e) {
      alert(`Install failed: ${e}`);
    }
  };

  const isInstalled = (name: string) => {
    return installedPlugins.some((p) => p.name.toLowerCase() === name.toLowerCase());
  };

  const isRepoAdded = (url: string) => {
    return repositories.some((r) => r.url.toLowerCase().trim() === url.toLowerCase().trim());
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

  // Calculate Storage Stats
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

  // Filtered curated repositories from cloudstreamrepo.com
  const filteredCatalogRepositories = useMemo(() => {
    const q = repoCatalogSearch.toLowerCase().trim();
    return ALL_CLOUDSTREAM_REPOSITORIES.filter((r) => {
      const matchesCategory =
        repoCatalogCategory === 'all' ||
        r.tags.some((t) => t.toLowerCase() === repoCatalogCategory.toLowerCase()) ||
        (repoCatalogCategory === 'bdix' && r.tags.includes('bangladeshi'));

      const matchesSearch =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.badge.toLowerCase().includes(q) ||
        r.shortcodes?.some((s) => s.toLowerCase().includes(q)) ||
        r.plugins?.some((p) => p.name.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [repoCatalogSearch, repoCatalogCategory]);

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

  // Filtered discover plugins across all repos
  const filteredDiscoverPlugins = useMemo(() => {
    return allAvailablePlugins.filter((p) => {
      const matchesSearch =
        !globalSearchQuery.trim() ||
        p.name.toLowerCase().includes(globalSearchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(globalSearchQuery.toLowerCase()) ||
        p.authors.some((a) => a.toLowerCase().includes(globalSearchQuery.toLowerCase()));

      const matchesType =
        activeTvType === 'All' || p.tv_types.some((t) => t.toLowerCase() === activeTvType.toLowerCase());

      const matchesLang =
        selectedLang === 'All' ||
        (selectedLang === 'Universal' && (!p.language || p.language === 'none')) ||
        (p.language && p.language.toLowerCase() === selectedLang.toLowerCase());

      return matchesSearch && matchesType && matchesLang;
    });
  }, [allAvailablePlugins, globalSearchQuery, activeTvType, selectedLang]);

  // Available languages across all available plugins
  const availableLanguagesAll = useMemo(() => {
    const set = new Set<string>();
    allAvailablePlugins.forEach((p) => {
      if (p.language && p.language !== 'none') {
        set.add(p.language);
      }
    });
    return Array.from(set);
  }, [allAvailablePlugins]);

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

  // Filtered installed plugins
  const filteredInstalledPlugins = useMemo(() => {
    return installedPlugins.filter((p) => {
      const matchesSearch =
        !installedSearchQuery.trim() ||
        p.name.toLowerCase().includes(installedSearchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(installedSearchQuery.toLowerCase());

      const matchesType =
        activeTvType === 'All' || p.tv_types.some((t) => t.toLowerCase() === activeTvType.toLowerCase());

      return matchesSearch && matchesType;
    });
  }, [installedPlugins, installedSearchQuery, activeTvType]);

  // Switch to a section helper
  const handleNavClick = (section: NavigationSection) => {
    setSelectedRepo(null);
    setNavSection(section);
    setActiveTvType('All');
    setSelectedLang('All');
  };

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100%',
        width: '100%',
        background: 'transparent',
        color: '#fff',
        fontFamily: 'var(--font-body)',
        alignItems: 'flex-start',
      }}
    >
      {/* =========================================================================
          LEFT SIDEBAR (Stremio Settings / Addons Signature Style)
          ========================================================================= */}
      <aside
        style={{
          width: '230px',
          flexShrink: 0,
          padding: '24px 14px 28px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderRight: '1px solid rgba(255, 255, 255, 0.04)',
          userSelect: 'none',
          position: 'sticky',
          top: 0,
          height: 'calc(100vh - var(--header-h, 56px))',
          overflowY: 'auto',
          alignSelf: 'flex-start',
          scrollbarWidth: 'none',
        }}
      >
        <div>
          {/* Section: Main Navigation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '28px' }}>
            {/* Discover Hub (31+ Repositories from cloudstreamrepo.com) */}
            <button
              onClick={() => handleNavClick('discover')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                borderRadius: '9999px',
                border: 'none',
                background: !selectedRepo && navSection === 'discover' ? '#201b3b' : 'transparent',
                color: !selectedRepo && navSection === 'discover' ? '#ffffff' : '#7d789e',
                fontSize: '14px',
                fontWeight: !selectedRepo && navSection === 'discover' ? 700 : 500,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (selectedRepo || navSection !== 'discover') {
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.035)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedRepo || navSection !== 'discover') {
                  e.currentTarget.style.color = '#7d789e';
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Compass size={16} color={!selectedRepo && navSection === 'discover' ? '#a78bfa' : '#656086'} />
                <span>Discover</span>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: !selectedRepo && navSection === 'discover' ? '#a78bfa' : '#555175',
                }}
              >
                {ALL_CLOUDSTREAM_REPOSITORIES.length}
              </span>
            </button>

            {/* Installed Extensions */}
            <button
              onClick={() => handleNavClick('installed')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                borderRadius: '9999px',
                border: 'none',
                background: !selectedRepo && navSection === 'installed' ? '#201b3b' : 'transparent',
                color: !selectedRepo && navSection === 'installed' ? '#ffffff' : '#7d789e',
                fontSize: '14px',
                fontWeight: !selectedRepo && navSection === 'installed' ? 700 : 500,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (selectedRepo || navSection !== 'installed') {
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.035)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedRepo || navSection !== 'installed') {
                  e.currentTarget.style.color = '#7d789e';
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle size={16} color={!selectedRepo && navSection === 'installed' ? '#34d399' : '#656086'} />
                <span>Installed</span>
              </div>
              {installedPlugins.length > 0 && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#34d399',
                    background: 'rgba(16, 185, 129, 0.12)',
                    padding: '1px 8px',
                    borderRadius: '9999px',
                  }}
                >
                  {installedPlugins.length}
                </span>
              )}
            </button>

            {/* Added Feeds / Repositories Overview */}
            <button
              onClick={() => handleNavClick('repositories')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                borderRadius: '9999px',
                border: 'none',
                background: !selectedRepo && navSection === 'repositories' ? '#201b3b' : 'transparent',
                color: !selectedRepo && navSection === 'repositories' ? '#ffffff' : '#7d789e',
                fontSize: '14px',
                fontWeight: !selectedRepo && navSection === 'repositories' ? 700 : 500,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (selectedRepo || navSection !== 'repositories') {
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.035)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedRepo || navSection !== 'repositories') {
                  e.currentTarget.style.color = '#7d789e';
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Server size={16} color={!selectedRepo && navSection === 'repositories' ? '#a78bfa' : '#656086'} />
                <span>My Feeds</span>
              </div>
              <span style={{ fontSize: '11px', color: '#555175', fontWeight: 600 }}>
                {repositories.length}
              </span>
            </button>

            {/* Manual Sideload */}
            <button
              onClick={() => handleNavClick('manual')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                borderRadius: '9999px',
                border: 'none',
                background: !selectedRepo && navSection === 'manual' ? '#201b3b' : 'transparent',
                color: !selectedRepo && navSection === 'manual' ? '#ffffff' : '#7d789e',
                fontSize: '14px',
                fontWeight: !selectedRepo && navSection === 'manual' ? 700 : 500,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (selectedRepo || navSection !== 'manual') {
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.035)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedRepo || navSection !== 'manual') {
                  e.currentTarget.style.color = '#7d789e';
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FolderOpen size={16} color={!selectedRepo && navSection === 'manual' ? '#fbbf24' : '#656086'} />
                <span>Sideload .CS3</span>
              </div>
            </button>
          </div>

          {/* Section: Added Feeds List in Sidebar */}
          {repositories.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div
                style={{
                  fontSize: '10.5px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  color: '#555175',
                  padding: '0 16px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Active Feeds</span>
                  {loadingRepos && <RefreshCw size={11} className="animate-spin" color="#8e8aa4" />}
                </div>
                <button
                  onClick={() => setShowAddRepoModal(true)}
                  title="Add new repository feed"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#a78bfa',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Plus size={13} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {repositories.map((repo) => {
                  const isSelected = selectedRepo?.url === repo.url;
                  const count = (repoPluginsMap[repo.url] || []).length || repo.plugin_count || 0;
                  return (
                    <button
                      key={repo.url}
                      onClick={() => {
                        setSelectedRepo(repo);
                        setNavSection('repositories');
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 16px',
                        borderRadius: '9999px',
                        border: 'none',
                        background: isSelected ? '#201b3b' : 'transparent',
                        color: isSelected ? '#ffffff' : '#7d789e',
                        fontSize: '13px',
                        fontWeight: isSelected ? 700 : 500,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.color = '#ffffff';
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.color = '#7d789e';
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                      title={repo.name}
                    >
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '140px',
                        }}
                      >
                        {repo.name.split(' ')[0]}
                      </span>
                      {count > 0 && (
                        <span style={{ fontSize: '10.5px', color: '#555175' }}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Add Repo CTA in sidebar */}
          <button
            onClick={() => setShowAddRepoModal(true)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '9999px',
              border: '1px dashed rgba(255, 255, 255, 0.12)',
              background: 'transparent',
              color: '#8e8aa4',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#a78bfa';
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.background = 'rgba(124, 58, 237, 0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
              e.currentTarget.style.color = '#8e8aa4';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <Plus size={14} />
            <span>Add Repository</span>
          </button>
        </div>

        {/* Sidebar Stremio-Style Footer Meta */}
        <div style={{ padding: '0 8px', color: '#555175', fontSize: '11px', lineHeight: '1.6' }}>
          <div>Engine: CloudStream 3</div>
          <div>Desktop: 6.0.1-desktop</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', color: '#34d399', fontWeight: 600 }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
            Provider Hub Online
          </div>
        </div>
      </aside>

      {/* =========================================================================
          RIGHT MAIN CONTENT AREA
          ========================================================================= */}
      <section
        style={{
          flex: 1,
          padding: '24px 36px 60px',
          minWidth: 0,
        }}
      >
        {/* Notification Toast */}
        {(message || copyFeedback) && (
          <div
            style={{
              padding: '12px 20px',
              background: '#201b3b',
              border: 'none',
              borderRadius: '12px',
              color: '#e2e8f0',
              fontSize: '13px',
              fontWeight: 600,
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Sparkles size={16} color="#a78bfa" />
              {copyFeedback || message}
            </div>
            <button
              onClick={() => {
                setMessage(null);
                setCopyFeedback(null);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#8e8aa4',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* =======================================================================
            VIEW A: SPECIFIC REPOSITORY VIEW (When a repository is clicked)
            ======================================================================= */}
        {selectedRepo ? (
          <div>
            {/* Header with Back Button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <button
                  onClick={() => setSelectedRepo(null)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'transparent',
                    border: 'none',
                    color: '#8e8aa4',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '0',
                    marginBottom: '8px',
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#8e8aa4')}
                >
                  <ArrowLeft size={14} />
                  <span>Back to Repositories</span>
                </button>

                <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#fff', margin: 0 }}>
                  {selectedRepo.name}
                </h1>
                <span
                  style={{
                    fontSize: '11px',
                    color: '#656086',
                    fontFamily: 'monospace',
                    display: 'inline-block',
                    marginTop: '4px',
                  }}
                >
                  {selectedRepo.url}
                </span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={() => fetchRepoPlugins(selectedRepo.url, true)}
                  disabled={loadingPlugins}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: 'none',
                    color: '#c7d2fe',
                    padding: '8px 16px',
                    borderRadius: '9999px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <RefreshCw size={13} className={loadingPlugins ? 'animate-spin' : ''} />
                  Refresh
                </button>

                <button
                  className="btn-primary"
                  onClick={() => handleInstallAllInRepo(currentRepoPlugins)}
                  disabled={installingAll || currentRepoPlugins.length === 0}
                  style={{
                    padding: '8px 18px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    borderRadius: '9999px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <CheckCheck size={15} />
                  {installingAll
                    ? `Installing (${installProgress?.current || 0}/${installProgress?.total || 0})...`
                    : `Install All (${currentRepoPlugins.length})`}
                </button>
              </div>
            </div>

            {/* Filter Bar (Search + Language + TV Types) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {/* Search Input */}
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '8px 18px',
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
                      fontSize: '13.5px',
                      fontWeight: 500,
                    }}
                  />
                  {repoSearchQuery && (
                    <button
                      onClick={() => setRepoSearchQuery('')}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#8e8aa4',
                        cursor: 'pointer',
                        display: 'flex',
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Language Filter */}
                {availableLanguagesInRepo.length > 0 && (
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      padding: '8px 14px',
                      borderRadius: '9999px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Globe size={14} color="#a78bfa" />
                    <select
                      value={selectedLang}
                      onChange={(e) => setSelectedLang(e.target.value)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#fff',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        outline: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="All" style={{ background: '#141228' }}>All Languages</option>
                      <option value="Universal" style={{ background: '#141228' }}>Universal / Multi</option>
                      {availableLanguagesInRepo.map((lang) => {
                        const info = getLanguageInfo(lang);
                        return (
                          <option key={lang} value={lang} style={{ background: '#141228' }}>
                            {info.flag} {info.name}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
              </div>

              {/* Category Pills */}
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px', scrollbarWidth: 'none' }}>
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
                        background: active ? '#201b3b' : 'rgba(255, 255, 255, 0.04)',
                        color: active ? '#ffffff' : '#7d789e',
                        fontSize: '12px',
                        fontWeight: active ? 700 : 500,
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

            {/* Grid of Extensions */}
            <div style={{ fontSize: '12px', color: '#656086', marginBottom: '16px', fontWeight: 600 }}>
              Showing {filteredRepoPlugins.length} of {currentRepoPlugins.length} extensions
            </div>

            {filteredRepoPlugins.length === 0 ? (
              <div
                style={{
                  padding: '60px 20px',
                  textAlign: 'center',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '16px',
                  color: '#7d789e',
                  fontSize: '13.5px',
                }}
              >
                No extensions match your filter criteria.
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '16px',
                }}
              >
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
        ) : navSection === 'discover' ? (
          /* =======================================================================
              VIEW B: DISCOVER HUB (All Repositories from cloudstreamrepo.com + Extensions)
              ======================================================================= */
          <div>
            {/* Top Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Discover Repositories</span>
                </h1>
                <p style={{ color: '#8e8aa4', fontSize: '13px', marginTop: '4px', margin: 0 }}>
                  Verified CloudStream repository feeds from <strong>cloudstreamrepo.com</strong> & community sources.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={handleSyncAll}
                  disabled={syncingAll}
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: 'none',
                    color: '#c7d2fe',
                    padding: '8px 16px',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)')}
                  title="Sync all active feeds"
                >
                  <RefreshCw size={13} className={syncingAll ? 'animate-spin' : ''} />
                  <span>Sync Feeds</span>
                </button>

                <button
                  className="btn-primary"
                  onClick={() => setShowAddRepoModal(true)}
                  style={{
                    padding: '8px 18px',
                    fontSize: '12px',
                    fontWeight: 700,
                    borderRadius: '9999px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Plus size={14} />
                  <span>Add Repository</span>
                </button>
              </div>
            </div>

            {/* Segmented Sub-View Switcher: Repositories Catalog vs Active Extensions */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '22px' }}>
              <button
                onClick={() => setDiscoverTab('repos')}
                style={{
                  padding: '7px 18px',
                  borderRadius: '9999px',
                  border: 'none',
                  background: discoverTab === 'repos' ? '#201b3b' : 'rgba(255, 255, 255, 0.035)',
                  color: discoverTab === 'repos' ? '#ffffff' : '#8e8aa4',
                  fontSize: '12.5px',
                  fontWeight: discoverTab === 'repos' ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease',
                }}
              >
                <Server size={14} color={discoverTab === 'repos' ? '#a78bfa' : '#656086'} />
                <span>All Repositories ({ALL_CLOUDSTREAM_REPOSITORIES.length})</span>
              </button>

              <button
                onClick={() => setDiscoverTab('extensions')}
                style={{
                  padding: '7px 18px',
                  borderRadius: '9999px',
                  border: 'none',
                  background: discoverTab === 'extensions' ? '#201b3b' : 'rgba(255, 255, 255, 0.035)',
                  color: discoverTab === 'extensions' ? '#ffffff' : '#8e8aa4',
                  fontSize: '12.5px',
                  fontWeight: discoverTab === 'extensions' ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease',
                }}
              >
                <Puzzle size={14} color={discoverTab === 'extensions' ? '#a78bfa' : '#656086'} />
                <span>Browse Added Providers ({allAvailablePlugins.length})</span>
              </button>
            </div>

            {/* SUB-VIEW 1: REPOSITORIES CATALOG (From cloudstreamrepo.com) */}
            {discoverTab === 'repos' ? (
              <div>
                {/* Search Bar & Categories */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '22px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      padding: '10px 18px',
                      borderRadius: '9999px',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <Search size={15} color="#8e8aa4" />
                    <input
                      type="text"
                      placeholder="Search 31 verified repositories, shortcodes (e.g. megarepo, bdix), or providers..."
                      value={repoCatalogSearch}
                      onChange={(e) => setRepoCatalogSearch(e.target.value)}
                      style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        color: '#fff',
                        fontSize: '13px',
                        fontWeight: 500,
                      }}
                    />
                    {repoCatalogSearch && (
                      <button
                        onClick={() => setRepoCatalogSearch('')}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#8e8aa4',
                          cursor: 'pointer',
                          display: 'flex',
                          padding: '2px',
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Category Pills */}
                  <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
                    {REPO_CATEGORIES.map((cat) => {
                      const active = repoCatalogCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => setRepoCatalogCategory(cat.id)}
                          style={{
                            padding: '5px 14px',
                            borderRadius: '9999px',
                            border: 'none',
                            background: active ? '#201b3b' : 'rgba(255, 255, 255, 0.035)',
                            color: active ? '#ffffff' : '#8e8aa4',
                            fontSize: '11.5px',
                            fontWeight: active ? 700 : 500,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (!active) {
                              e.currentTarget.style.color = '#fff';
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!active) {
                              e.currentTarget.style.color = '#8e8aa4';
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.035)';
                            }
                          }}
                        >
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Counter */}
                <div style={{ fontSize: '11.5px', color: '#656086', marginBottom: '16px', fontWeight: 600 }}>
                  Showing {filteredCatalogRepositories.length} of {ALL_CLOUDSTREAM_REPOSITORIES.length} verified repositories
                </div>

                {/* Repositories Cards Grid */}
                {filteredCatalogRepositories.length === 0 ? (
                  <div
                    style={{
                      padding: '60px 20px',
                      textAlign: 'center',
                      background: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: '16px',
                      color: '#7d789e',
                      fontSize: '13px',
                    }}
                  >
                    No repositories match "{repoCatalogSearch}". You can add custom repositories using the "Add Repository" button.
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                      gap: '16px',
                    }}
                  >
                    {filteredCatalogRepositories.map((repo) => {
                      const added = isRepoAdded(repo.directInstall);
                      const isExpanded = expandedRepoPlugins[repo.id];
                      const pluginsToShow = isExpanded
                        ? repo.plugins || []
                        : (repo.plugins || []).slice(0, 5);

                      return (
                        <div
                          key={repo.id + repo.directInstall}
                          style={{
                            padding: '20px 22px',
                            background: 'rgba(255, 255, 255, 0.035)',
                            borderRadius: '16px',
                            border: 'none',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            transition: 'all 0.15s ease',
                            minHeight: '230px',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.065)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.035)';
                          }}
                        >
                          <div>
                            {/* Card Header: Icon, Title, Badge */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px', gap: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {repo.iconUrl ? (
                                  <div
                                    style={{
                                      width: '42px',
                                      height: '42px',
                                      borderRadius: '12px',
                                      background: repo.iconBg || 'rgba(255, 255, 255, 0.05)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      overflow: 'hidden',
                                      flexShrink: 0,
                                      padding: '2px',
                                    }}
                                  >
                                    <img
                                      src={repo.iconUrl}
                                      alt={repo.name}
                                      style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                        borderRadius: '10px',
                                      }}
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        if (e.currentTarget.parentElement) {
                                          e.currentTarget.parentElement.innerHTML = `<span style="font-size: 20px;">${repo.icon || '📦'}</span>`;
                                        }
                                      }}
                                    />
                                  </div>
                                ) : (
                                  <div
                                    style={{
                                      width: '42px',
                                      height: '42px',
                                      borderRadius: '12px',
                                      background: repo.iconBg || 'rgba(124, 58, 237, 0.15)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '20px',
                                      flexShrink: 0,
                                    }}
                                  >
                                    {repo.icon || '📦'}
                                  </div>
                                )}
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: '14.5px', color: '#fff', lineHeight: 1.25 }}>
                                    {repo.name}
                                  </div>
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      fontWeight: 600,
                                      color: '#c4b5fd',
                                      background: 'rgba(124, 58, 237, 0.12)',
                                      padding: '1px 8px',
                                      borderRadius: '9999px',
                                      display: 'inline-block',
                                      marginTop: '3px',
                                    }}
                                  >
                                    {repo.badge}
                                  </span>
                                </div>
                              </div>

                              {added ? (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    color: '#34d399',
                                    background: 'rgba(16, 185, 129, 0.12)',
                                    padding: '2px 8px',
                                    borderRadius: '9999px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    flexShrink: 0,
                                  }}
                                >
                                  <Check size={11} /> ADDED
                                </span>
                              ) : null}
                            </div>

                            {/* Description */}
                            <p
                              style={{
                                fontSize: '12px',
                                color: '#8e8aa4',
                                lineHeight: '1.45',
                                marginBottom: '12px',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                minHeight: '34px',
                              }}
                            >
                              {repo.description}
                            </p>

                            {/* Shortcodes */}
                            {repo.shortcodes && repo.shortcodes.length > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                                {repo.shortcodes.map((code) => (
                                  <button
                                    key={code}
                                    type="button"
                                    onClick={(e) => handleCopyText(code, `Copied shortcode "${code}"!`, e)}
                                    title={`Click to copy shortcode "${code}"`}
                                    style={{
                                      background: 'rgba(255, 255, 255, 0.04)',
                                      border: 'none',
                                      color: '#c7d2fe',
                                      padding: '2px 8px',
                                      borderRadius: '6px',
                                      fontSize: '10.5px',
                                      fontFamily: 'monospace',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      transition: 'background 0.15s ease',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(124, 58, 237, 0.25)')}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)')}
                                  >
                                    ⚡ {code}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Included Plugins Preview */}
                            {repo.plugins && repo.plugins.length > 0 && (
                              <div style={{ marginBottom: '14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                  <span style={{ fontSize: '10px', color: '#656086', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                    Included Providers ({repo.plugins.length}):
                                  </span>
                                  {repo.plugins.length > 5 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedRepoPlugins((prev) => ({
                                          ...prev,
                                          [repo.id]: !prev[repo.id],
                                        }))
                                      }
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#a78bfa',
                                        fontSize: '10.5px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '2px',
                                        padding: 0,
                                      }}
                                    >
                                      {isExpanded ? 'Show less' : `+${repo.plugins.length - 5} more`}
                                    </button>
                                  )}
                                </div>

                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                  {pluginsToShow.map((p) => (
                                    <span
                                      key={p.name}
                                      style={{
                                        fontSize: '10px',
                                        background: p.featured ? 'rgba(124, 58, 237, 0.15)' : 'rgba(255, 255, 255, 0.035)',
                                        color: p.featured ? '#c4b5fd' : '#8e8aa4',
                                        padding: '2px 7px',
                                        borderRadius: '6px',
                                        fontWeight: p.featured ? 600 : 500,
                                      }}
                                    >
                                      {p.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Footer Actions */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingTop: '10px',
                              gap: '8px',
                            }}
                          >
                            {added ? (
                              <button
                                onClick={() => {
                                  const entry = repositories.find(
                                    (r) => r.url.toLowerCase() === repo.directInstall.toLowerCase()
                                  );
                                  if (entry) {
                                    setSelectedRepo(entry);
                                  }
                                }}
                                style={{
                                  padding: '6px 14px',
                                  fontSize: '11.5px',
                                  fontWeight: 600,
                                  borderRadius: '9999px',
                                  border: 'none',
                                  background: 'rgba(124, 58, 237, 0.15)',
                                  color: '#c4b5fd',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(124, 58, 237, 0.25)')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(124, 58, 237, 0.15)')}
                              >
                                <Layers size={13} />
                                Browse Feed
                              </button>
                            ) : (
                              <button
                                className="btn-primary"
                                onClick={() => handleAddRepo(repo.directInstall, repo.name)}
                                disabled={isAddingRepo}
                                style={{
                                  padding: '6px 16px',
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  borderRadius: '9999px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                }}
                              >
                                <Plus size={13} />
                                Add Repository
                              </button>
                            )}

                            {/* Copy & External Links */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <button
                                type="button"
                                onClick={(e) => handleCopyText(repo.directInstall, `Copied "${repo.name}" manifest URL!`, e)}
                                title="Copy direct repository manifest URL"
                                style={{
                                  background: 'rgba(255, 255, 255, 0.04)',
                                  border: 'none',
                                  color: '#8e8aa4',
                                  padding: '6px',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = '#fff';
                                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = '#8e8aa4';
                                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                                }}
                              >
                                <Copy size={13} />
                              </button>

                              {repo.webpage && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenExternal(repo.webpage)}
                                  title="View on GitHub / Source"
                                  style={{
                                    background: 'rgba(255, 255, 255, 0.04)',
                                    border: 'none',
                                    color: '#8e8aa4',
                                    padding: '6px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    transition: 'all 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.color = '#fff';
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.color = '#8e8aa4';
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                                  }}
                                >
                                  <ExternalLink size={13} />
                                </button>
                              )}

                              {repo.community && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenExternal(repo.community)}
                                  title="Join Discord Community"
                                  style={{
                                    background: 'rgba(124, 58, 237, 0.12)',
                                    border: 'none',
                                    color: '#c4b5fd',
                                    padding: '6px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    transition: 'all 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(124, 58, 237, 0.25)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(124, 58, 237, 0.12)';
                                  }}
                                >
                                  <MessageSquare size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* SUB-VIEW 2: EXTENSIONS BROWSER (Across your active added repositories) */
              <div>
                {/* Storage Progress Bar (Minimal) */}
                <div
                  onClick={() => handleNavClick('installed')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.035)',
                    borderRadius: '14px',
                    padding: '14px 20px',
                    marginBottom: '20px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.035)')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: 'rgba(124, 58, 237, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#a78bfa',
                      }}
                    >
                      <HardDrive size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', color: '#fff', fontWeight: 700 }}>
                        Extension Library
                      </div>
                      <span style={{ fontSize: '11.5px', color: '#8e8aa4' }}>
                        {stats.downloaded} Installed · {stats.total} Available across registered feeds
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '220px' }}>
                    <div
                      style={{
                        flex: 1,
                        height: '6px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        borderRadius: '9999px',
                        overflow: 'hidden',
                        display: 'flex',
                      }}
                    >
                      <div
                        style={{
                          width: `${stats.downloadedPercent}%`,
                          background: 'linear-gradient(90deg, #10b981, #34d399)',
                          borderRadius: '9999px',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 700 }}>
                      {Math.round(stats.downloadedPercent)}%
                    </span>
                  </div>
                </div>

                {/* Filter Bar (Search + Language + TV Types) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '22px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {/* Search Input */}
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        padding: '10px 18px',
                        borderRadius: '9999px',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <Search size={15} color="#8e8aa4" />
                      <input
                        type="text"
                        placeholder="Search all installed & available providers..."
                        value={globalSearchQuery}
                        onChange={(e) => setGlobalSearchQuery(e.target.value)}
                        style={{
                          flex: 1,
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          color: '#fff',
                          fontSize: '13px',
                          fontWeight: 500,
                        }}
                      />
                      {globalSearchQuery && (
                        <button
                          onClick={() => setGlobalSearchQuery('')}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#8e8aa4',
                            cursor: 'pointer',
                            display: 'flex',
                            padding: '2px',
                          }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {/* Language Selector */}
                    {availableLanguagesAll.length > 0 && (
                      <div
                        style={{
                          background: 'rgba(255, 255, 255, 0.04)',
                          padding: '9px 16px',
                          borderRadius: '9999px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Globe size={14} color="#a78bfa" />
                        <select
                          value={selectedLang}
                          onChange={(e) => setSelectedLang(e.target.value)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#fff',
                            fontSize: '12px',
                            fontWeight: 600,
                            outline: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          <option value="All" style={{ background: '#141228' }}>All Languages</option>
                          <option value="Universal" style={{ background: '#141228' }}>Universal / Multi</option>
                          {availableLanguagesAll.map((lang) => {
                            const info = getLanguageInfo(lang);
                            return (
                              <option key={lang} value={lang} style={{ background: '#141228' }}>
                                {info.flag} {info.name}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Category Pills */}
                  <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
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
                            background: active ? '#201b3b' : 'rgba(255, 255, 255, 0.035)',
                            color: active ? '#ffffff' : '#8e8aa4',
                            fontSize: '11.5px',
                            fontWeight: active ? 700 : 500,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (!active) {
                              e.currentTarget.style.color = '#fff';
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!active) {
                              e.currentTarget.style.color = '#8e8aa4';
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.035)';
                            }
                          }}
                        >
                          {type}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Grid Header Counter */}
                <div style={{ fontSize: '11.5px', color: '#656086', marginBottom: '16px', fontWeight: 600 }}>
                  Showing {filteredDiscoverPlugins.length} of {allAvailablePlugins.length} extensions across your added feeds
                </div>

                {filteredDiscoverPlugins.length === 0 ? (
                  <div
                    style={{
                      padding: '60px 20px',
                      textAlign: 'center',
                      background: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: '16px',
                      color: '#7d789e',
                      fontSize: '13px',
                    }}
                  >
                    No extensions match your filters. Add more repositories from the "All Repositories" tab above.
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                      gap: '16px',
                    }}
                  >
                    {filteredDiscoverPlugins.map((plugin) => (
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
          </div>
        ) : navSection === 'installed' ? (
          /* =======================================================================
              VIEW C: INSTALLED EXTENSIONS
              ======================================================================= */
          <div>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.3px' }}>
                  Installed Extensions
                </h1>
                <p style={{ color: '#7d789e', fontSize: '13.5px', marginTop: '4px', margin: 0 }}>
                  {installedPlugins.length} active provider plugins (.cs3) ready for streaming.
                </p>
              </div>

              {installedPlugins.length > 0 && (
                <button
                  onClick={handleUninstallAll}
                  style={{
                    background: 'rgba(244, 63, 94, 0.1)',
                    border: 'none',
                    color: '#fb7185',
                    padding: '8px 16px',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(244, 63, 94, 0.2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(244, 63, 94, 0.1)')}
                >
                  <Trash2 size={13} />
                  <span>Uninstall All</span>
                </button>
              )}
            </div>

            {/* Search Filter */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '8px 18px',
                borderRadius: '9999px',
                marginBottom: '24px',
              }}
            >
              <Search size={16} color="#8e8aa4" />
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
                  fontSize: '13.5px',
                  fontWeight: 500,
                }}
              />
              {installedSearchQuery && (
                <button
                  onClick={() => setInstalledSearchQuery('')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#8e8aa4',
                    cursor: 'pointer',
                    display: 'flex',
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Grid */}
            {filteredInstalledPlugins.length === 0 ? (
              <div
                style={{
                  padding: '60px 20px',
                  textAlign: 'center',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '16px',
                  color: '#7d789e',
                }}
              >
                <Puzzle size={36} color="#555175" style={{ marginBottom: '12px' }} />
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
                  No Extensions Installed
                </div>
                <p style={{ fontSize: '13px', maxWidth: '380px', margin: '0 auto 20px' }}>
                  Browse available repositories to install domestic and international streaming providers.
                </p>
                <button
                  className="btn-primary"
                  onClick={() => handleNavClick('discover')}
                  style={{ padding: '8px 20px', fontSize: '13px', borderRadius: '9999px' }}
                >
                  Discover Repositories
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '16px',
                }}
              >
                {filteredInstalledPlugins.map((plugin) => (
                  <ExtensionCard
                    key={plugin.id}
                    plugin={plugin}
                    isInstalled={true}
                    onInstall={handleInstallPlugin}
                    onDelete={handleDeletePlugin}
                    onSelectExtension={onSelectExtension}
                    onOpenDetail={() => setDetailPlugin(plugin)}
                    onVote={(e) => handleVote(plugin.name, e)}
                    votes={votesMap[plugin.name]}
                    installing={false}
                    formatFileSize={formatFileSize}
                    getLanguageInfo={getLanguageInfo}
                  />
                ))}
              </div>
            )}
          </div>
        ) : navSection === 'repositories' ? (
          /* =======================================================================
              VIEW D: MY ADDED FEEDS & REPOSITORIES
              ======================================================================= */
          <div>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.3px' }}>
                  My Added Feeds
                </h1>
                <p style={{ color: '#7d789e', fontSize: '13.5px', marginTop: '4px', margin: 0 }}>
                  Manage your active CloudStream repository subscriptions and manifest feeds.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {repositories.length > 0 && (
                  <button
                    onClick={handleDeleteAllRepos}
                    style={{
                      background: 'rgba(244, 63, 94, 0.1)',
                      border: 'none',
                      color: '#fb7185',
                      padding: '8px 16px',
                      borderRadius: '9999px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Trash2 size={13} />
                    <span>Clean All</span>
                  </button>
                )}

                <button
                  className="btn-primary"
                  onClick={() => setShowAddRepoModal(true)}
                  style={{
                    padding: '8px 18px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    borderRadius: '9999px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Plus size={15} />
                  <span>Add Repository</span>
                </button>
              </div>
            </div>

            {/* Repositories Cards Grid */}
            {repositories.length === 0 ? (
              <div
                style={{
                  padding: '60px 20px',
                  textAlign: 'center',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '16px',
                  color: '#7d789e',
                }}
              >
                <Server size={36} color="#555175" style={{ marginBottom: '12px' }} />
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
                  No Repositories Added
                </div>
                <p style={{ fontSize: '13px', maxWidth: '420px', margin: '0 auto 20px' }}>
                  Add a repository feed URL or pick from the 31+ verified community repositories in the Discover tab.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                  <button
                    className="btn-primary"
                    onClick={() => handleNavClick('discover')}
                    style={{ padding: '8px 20px', fontSize: '13px', borderRadius: '9999px' }}
                  >
                    Discover Repositories
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setShowAddRepoModal(true)}
                    style={{ padding: '8px 20px', fontSize: '13px', borderRadius: '9999px' }}
                  >
                    Custom URL
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                  gap: '16px',
                }}
              >
                {repositories.map((repo) => {
                  const pluginsInRepo = repoPluginsMap[repo.url] || [];
                  return (
                    <div
                      key={repo.url}
                      onClick={() => setSelectedRepo(repo)}
                      style={{
                        padding: '18px 20px',
                        background: 'rgba(255, 255, 255, 0.035)',
                        borderRadius: '14px',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.035)';
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '10px',
                                background: 'rgba(124, 58, 237, 0.15)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#a78bfa',
                              }}
                            >
                              <Globe size={18} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '15px', color: '#fff' }}>
                                {repo.name}
                              </div>
                              <span style={{ fontSize: '11.5px', color: '#7d789e' }}>
                                {pluginsInRepo.length > 0
                                  ? `${pluginsInRepo.length} extensions`
                                  : repo.plugin_count > 0
                                  ? `${repo.plugin_count} extensions`
                                  : 'Click to inspect'}
                              </span>
                            </div>
                          </div>

                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              color: '#34d399',
                              background: 'rgba(16, 185, 129, 0.12)',
                              padding: '2px 8px',
                              borderRadius: '9999px',
                            }}
                          >
                            ACTIVE
                          </span>
                        </div>

                        <div
                          style={{
                            fontSize: '11px',
                            color: '#656086',
                            fontFamily: 'monospace',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            background: 'rgba(0, 0, 0, 0.25)',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            marginBottom: '16px',
                          }}
                        >
                          {repo.url}
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingTop: '12px',
                        }}
                      >
                        <button
                          className="btn-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRepo(repo);
                          }}
                          style={{ padding: '5px 14px', fontSize: '11.5px', borderRadius: '9999px', display: 'flex', alignItems: 'center', gap: '5px' }}
                        >
                          <Layers size={13} />
                          Browse
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={(e) => handleCopyShareLink(repo, e)}
                            title="Copy shareable link"
                            style={{
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: 'none',
                              color: '#8e8aa4',
                              padding: '6px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              display: 'flex',
                            }}
                          >
                            <Copy size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDeleteRepo(repo, e)}
                            title="Delete repository"
                            style={{
                              background: 'rgba(244, 63, 94, 0.1)',
                              border: 'none',
                              color: '#f43f5e',
                              padding: '6px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              display: 'flex',
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* =======================================================================
              VIEW E: DIRECT / MANUAL SIDELOAD
              ======================================================================= */
          <div>
            <div style={{ marginBottom: '24px' }}>
              <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.3px' }}>
                Sideload Extensions
              </h1>
              <p style={{ color: '#7d789e', fontSize: '13.5px', marginTop: '4px', margin: 0 }}>
                Install local .cs3 plugin packages or download directly from custom URLs.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '640px' }}>
              {/* Local File Box */}
              <div
                style={{
                  padding: '24px',
                  background: 'rgba(255, 255, 255, 0.035)',
                  borderRadius: '16px',
                  border: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <FolderOpen size={18} color="#fbbf24" />
                  <span style={{ fontWeight: 700, fontSize: '15px', color: '#fff' }}>
                    Install Local File (.cs3)
                  </span>
                </div>
                <p style={{ fontSize: '12.5px', color: '#7d789e', marginBottom: '14px' }}>
                  Enter the absolute path to your downloaded CloudStream extension .cs3 file.
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    placeholder="e.g. C:\Downloads\CineplexBD.cs3"
                    value={localFilePath}
                    onChange={(e) => setLocalFilePath(e.target.value)}
                    style={{
                      flex: 1,
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: 'none',
                      padding: '10px 16px',
                      borderRadius: '10px',
                      color: '#fff',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                  <button
                    className="btn-primary"
                    onClick={handleInstallLocalFile}
                    style={{ padding: '8px 18px', borderRadius: '10px', fontSize: '12.5px' }}
                  >
                    Install
                  </button>
                </div>
              </div>

              {/* Direct URL Box */}
              <div
                style={{
                  padding: '24px',
                  background: 'rgba(255, 255, 255, 0.035)',
                  borderRadius: '16px',
                  border: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <Link size={18} color="#a78bfa" />
                  <span style={{ fontWeight: 700, fontSize: '15px', color: '#fff' }}>
                    Install from Direct URL
                  </span>
                </div>
                <p style={{ fontSize: '12.5px', color: '#7d789e', marginBottom: '14px' }}>
                  Provide a direct HTTP download link to a .cs3 extension bundle.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input
                    type="text"
                    placeholder="Extension Name (Optional, e.g. CineplexBD)"
                    value={directName}
                    onChange={(e) => setDirectName(e.target.value)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: 'none',
                      padding: '10px 16px',
                      borderRadius: '10px',
                      color: '#fff',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="text"
                      placeholder="https://example.com/extension.cs3"
                      value={directUrl}
                      onChange={(e) => setDirectUrl(e.target.value)}
                      style={{
                        flex: 1,
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: 'none',
                        padding: '10px 16px',
                        borderRadius: '10px',
                        color: '#fff',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                    />
                    <button
                      className="btn-primary"
                      onClick={handleInstallDirectUrl}
                      style={{ padding: '8px 18px', borderRadius: '10px', fontSize: '12.5px' }}
                    >
                      Install
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* =========================================================================
          MODAL 1: ADD REPOSITORY DIALOG (With Quick Search over 31+ Repos)
          ========================================================================= */}
      {showAddRepoModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowAddRepoModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(5, 5, 15, 0.8)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '560px',
              padding: '30px',
              background: '#16132f',
              border: 'none',
              borderRadius: '20px',
              boxShadow: '0 24px 70px rgba(0, 0, 0, 0.85)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                <Server size={20} color="#a78bfa" />
                Add CloudStream Repository
              </h2>
              <button
                onClick={() => setShowAddRepoModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#8e8aa4', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#7d789e', marginBottom: '18px', lineHeight: '1.5' }}>
              Enter a repository URL, raw GitHub repo.json link, or shortcode (e.g. <code style={{ color: '#c4b5fd' }}>megarepo</code>, <code style={{ color: '#c4b5fd' }}>cspr</code>, <code style={{ color: '#c4b5fd' }}>bdix</code>).
            </p>

            {/* Quick Presets Carousel */}
            <div style={{ marginBottom: '18px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#555175', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
                Featured Presets:
              </span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', maxHeight: '110px', overflowY: 'auto' }}>
                {ALL_CLOUDSTREAM_REPOSITORIES.slice(0, 8).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setNewRepoName(preset.name);
                      setNewRepoUrl(preset.directInstall);
                    }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '9999px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: 'none',
                      color: '#c7d2fe',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(124, 58, 237, 0.25)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
                  >
                    {preset.iconUrl ? (
                      <img
                        src={preset.iconUrl}
                        alt=""
                        style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover' }}
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    ) : (
                      <span>{preset.icon || '📦'}</span>
                    )}
                    <span>{preset.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#c7d2fe', display: 'block', marginBottom: '6px' }}>
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
                    border: 'none',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#c7d2fe' }}>
                    Repository URL or Shortcode:
                  </label>
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#a78bfa',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Share2 size={12} />
                    Paste
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="https://raw.githubusercontent.com/.../repo.json or shortcode"
                  value={newRepoUrl}
                  onChange={(e) => setNewRepoUrl(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: 'none',
                    borderRadius: '10px',
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
              <button
                className="btn-secondary"
                onClick={() => setShowAddRepoModal(false)}
                style={{ padding: '8px 18px', borderRadius: '9999px', fontSize: '12.5px' }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={() => handleAddRepo()}
                disabled={isAddingRepo || !newRepoUrl.trim()}
                style={{ padding: '8px 20px', borderRadius: '9999px', fontSize: '12.5px' }}
              >
                {isAddingRepo ? 'Adding...' : 'Add Repository'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: PLUGIN DETAILS MODAL
          ========================================================================= */}
      {detailPlugin && (
        <div
          className="modal-backdrop"
          onClick={() => setDetailPlugin(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(5, 5, 15, 0.8)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '600px',
              padding: '30px',
              background: '#16132f',
              border: 'none',
              borderRadius: '20px',
              boxShadow: '0 24px 70px rgba(0, 0, 0, 0.85)',
            }}
          >
            {/* Header with Icon, Name & Status */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                {detailPlugin.icon_url ? (
                  <img
                    src={detailPlugin.icon_url}
                    alt={detailPlugin.name}
                    style={{ width: '52px', height: '52px', borderRadius: '12px', objectFit: 'contain', background: 'rgba(255,255,255,0.05)', padding: '4px' }}
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                ) : (
                  <div
                    style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '12px',
                      background: 'rgba(124, 58, 237, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#a78bfa',
                    }}
                  >
                    <Puzzle size={26} />
                  </div>
                )}
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1.2 }}>
                    {detailPlugin.name}
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <span style={{ fontSize: '12px', color: '#a78bfa', fontWeight: 700 }}>
                      v{detailPlugin.version}
                    </span>
                    <span style={{ fontSize: '11px', color: '#555175' }}>•</span>
                    <span
                      style={{
                        fontSize: '10.5px',
                        color: detailPlugin.status === 'down' ? '#fca5a5' : '#34d399',
                        fontWeight: 700,
                      }}
                    >
                      {detailPlugin.status === 'down' ? 'OFFLINE' : 'OPERATIONAL'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setDetailPlugin(null)}
                style={{ background: 'transparent', border: 'none', color: '#8e8aa4', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Metadata Badges */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '14px',
                borderRadius: '12px',
                marginBottom: '18px',
              }}
            >
              <div>
                <span style={{ fontSize: '10px', color: '#7d789e', display: 'block', fontWeight: 700, textTransform: 'uppercase' }}>Authors</span>
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#fff' }}>
                  {detailPlugin.authors.length > 0 ? detailPlugin.authors.join(', ') : 'Community'}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: '#7d789e', display: 'block', fontWeight: 700, textTransform: 'uppercase' }}>Language</span>
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#fff' }}>
                  {getLanguageInfo(detailPlugin.language).flag} {getLanguageInfo(detailPlugin.language).name}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: '#7d789e', display: 'block', fontWeight: 700, textTransform: 'uppercase' }}>Size</span>
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#fff' }}>
                  {formatFileSize(detailPlugin.file_size) || 'Standard (.cs3)'}
                </span>
              </div>
            </div>

            {/* Categories */}
            {detailPlugin.tv_types.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#7d789e', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Categories:
                </span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {detailPlugin.tv_types.map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: '11px',
                        background: 'rgba(124, 58, 237, 0.15)',
                        color: '#c4b5fd',
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
            <div style={{ marginBottom: '18px' }}>
              <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#7d789e', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                Description:
              </span>
              <p style={{ fontSize: '12.5px', color: '#cbd5e1', lineHeight: '1.6', background: 'rgba(0,0,0,0.25)', padding: '12px 14px', borderRadius: '10px' }}>
                {detailPlugin.description || 'CloudStream provider plugin with media scraping, link extraction, and metadata support.'}
              </p>
            </div>

            {/* Repository Source Link */}
            {detailPlugin.repository_url && (
              <div style={{ marginBottom: '20px' }}>
                <button
                  type="button"
                  onClick={() => handleOpenExternal(detailPlugin.repository_url)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#a78bfa',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: 0,
                  }}
                >
                  <ExternalLink size={14} />
                  <span>View Source Repository Feed</span>
                </button>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '18px' }}>
              {isInstalled(detailPlugin.name) ? (
                <div style={{ display: 'flex', gap: '10px' }}>
                  {onSelectExtension && (
                    <button
                      className="btn-primary"
                      onClick={() => {
                        onSelectExtension(detailPlugin.name);
                        setDetailPlugin(null);
                      }}
                      style={{ padding: '8px 18px', fontSize: '12.5px', borderRadius: '9999px', display: 'flex', alignItems: 'center', gap: '6px' }}
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
                      border: 'none',
                      color: '#f43f5e',
                      padding: '8px 16px',
                      borderRadius: '9999px',
                      cursor: 'pointer',
                      fontSize: '12.5px',
                      fontWeight: 700,
                    }}
                  >
                    Uninstall
                  </button>
                </div>
              ) : (
                <button
                  className="btn-primary"
                  onClick={() => handleInstallPlugin(detailPlugin)}
                  disabled={installingId === detailPlugin.id}
                  style={{ padding: '8px 22px', fontSize: '12.5px', borderRadius: '9999px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Download size={14} />
                  {installingId === detailPlugin.id ? 'Installing (.cs3)...' : 'Install Extension'}
                </button>
              )}

              <button
                className="btn-secondary"
                onClick={() => setDetailPlugin(null)}
                style={{ padding: '8px 18px', borderRadius: '9999px', fontSize: '12.5px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Color generator for extensions without icons or failed images
const getPluginColor = (name: string) => {
  const gradients = [
    { bg: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff' },
    { bg: 'linear-gradient(135deg, #ec4899, #f43f5e)', color: '#fff' },
    { bg: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff' },
    { bg: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff' },
    { bg: 'linear-gradient(135deg, #06b6d4, #0284c7)', color: '#fff' },
    { bg: 'linear-gradient(135deg, #8b5cf6, #d946ef)', color: '#fff' },
    { bg: 'linear-gradient(135deg, #14b8a6, #0d9488)', color: '#fff' },
    { bg: 'linear-gradient(135deg, #f97316, #ea580c)', color: '#fff' },
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return gradients[Math.abs(hash) % gradients.length];
};

// Reusable Stremio-Style Extension Card Component
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
  const [imgError, setImgError] = useState(false);
  const langInfo = getLanguageInfo(plugin.language);
  const fileSize = formatFileSize(plugin.file_size);
  const colorTheme = getPluginColor(plugin.name);

  return (
    <div
      onClick={onOpenDetail}
      style={{
        padding: '16px 18px',
        background: 'rgba(255, 255, 255, 0.035)',
        border: 'none',
        borderRadius: '14px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        minHeight: '155px',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.065)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.035)';
      }}
    >
      <div>
        {/* Header: Icon, Title, Version & Status */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {plugin.icon_url && !imgError ? (
              <img
                src={plugin.icon_url}
                alt={plugin.name}
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  objectFit: 'contain',
                  background: 'rgba(255, 255, 255, 0.04)',
                  padding: '3px',
                  flexShrink: 0,
                }}
                onError={() => setImgError(true)}
              />
            ) : (
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: colorTheme.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: colorTheme.color,
                  fontWeight: 800,
                  fontSize: '15px',
                  letterSpacing: '-0.5px',
                  flexShrink: 0,
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                }}
              >
                {plugin.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#fff', lineHeight: 1.25 }}>
                {plugin.name}
              </div>
              <span style={{ fontSize: '11px', color: '#656086', fontWeight: 500 }}>v{plugin.version}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            {isInstalled ? (
              <span
                style={{
                  fontSize: '9.5px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: '#34d399',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                <Check size={10} /> INSTALLED
              </span>
            ) : plugin.status === 'down' ? (
              <span
                style={{
                  fontSize: '9.5px',
                  background: 'rgba(239, 68, 68, 0.12)',
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

        {/* Badges */}
        <div style={{ display: 'flex', gap: '5px', marginBottom: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', fontWeight: 600, background: 'rgba(124, 58, 237, 0.12)', color: '#c4b5fd', padding: '1px 8px', borderRadius: '9999px' }}>
            {langInfo.flag} {langInfo.name}
          </span>

          {fileSize && (
            <span style={{ fontSize: '10px', fontWeight: 600, background: 'rgba(255, 255, 255, 0.04)', color: '#8e8aa4', padding: '1px 8px', borderRadius: '9999px' }}>
              {fileSize}
            </span>
          )}

          {plugin.tv_types.slice(0, 2).map((t) => (
            <span key={t} style={{ fontSize: '10px', fontWeight: 600, background: 'rgba(255, 255, 255, 0.04)', color: '#8e8aa4', padding: '1px 8px', borderRadius: '9999px' }}>
              {t}
            </span>
          ))}
        </div>

        {/* Description snippet */}
        <p
          style={{
            fontSize: '11.5px',
            color: '#8e8aa4',
            lineHeight: '1.45',
            marginBottom: '12px',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {plugin.description || 'CloudStream provider plugin with media scraping and link extraction.'}
        </p>
      </div>

      {/* Footer Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px' }}>
        <button
          type="button"
          onClick={onVote}
          style={{
            background: votes?.userVoted ? 'rgba(124, 58, 237, 0.15)' : 'transparent',
            border: 'none',
            color: votes?.userVoted ? '#c4b5fd' : '#555175',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 6px',
            borderRadius: '6px',
            transition: 'color 0.15s ease',
          }}
          title="Upvote extension"
        >
          <ThumbsUp size={11} fill={votes?.userVoted ? '#c4b5fd' : 'none'} />
          {votes?.count || 12}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isInstalled ? (
            <>
              {onSelectExtension && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectExtension(plugin.name);
                  }}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    borderRadius: '9999px',
                    border: 'none',
                    background: 'rgba(124, 58, 237, 0.15)',
                    color: '#c4b5fd',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(124, 58, 237, 0.25)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(124, 58, 237, 0.15)')}
                  title="Browse extension on Home"
                >
                  <Globe size={11} />
                  Browse
                </button>
              )}
              <button
                type="button"
                onClick={(e) => onDelete(plugin.name, e)}
                style={{
                  background: 'rgba(244, 63, 94, 0.1)',
                  border: 'none',
                  color: '#f43f5e',
                  padding: '5px 8px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(244, 63, 94, 0.2)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(244, 63, 94, 0.1)')}
                title="Uninstall extension"
              >
                <Trash2 size={12} />
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={(e) => onInstall(plugin, e)}
              disabled={installing}
              style={{
                padding: '4px 14px',
                fontSize: '11.5px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                borderRadius: '9999px',
              }}
            >
              <Download size={12} />
              {installing ? 'Installing...' : 'Install'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
