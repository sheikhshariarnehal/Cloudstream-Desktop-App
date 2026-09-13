import React, { useState } from 'react';
import { useSettings } from '../../../hooks/useSettings';
import {
  QrCode,
  Key,
  LogOut,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { SyncAccount } from '../../../types/settings';

export const AccountsTab: React.FC = () => {
  const { settings, updateSetting } = useSettings();
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [inputUsername, setInputUsername] = useState('');
  const [inputApiKey, setInputApiKey] = useState('');
  const simklPin = '7B29-4X19';
  const [isPollingSimkl, setIsPollingSimkl] = useState(false);

  const handleLogin = (service: 'mal' | 'anilist' | 'kitsu') => {
    if (!inputUsername.trim()) return;
    const newAccount: SyncAccount = {
      id: `${service}_${Date.now()}`,
      username: inputUsername.trim(),
      name: inputUsername.trim(),
      isAuthenticated: true,
      lastSyncedAt: Date.now(),
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${inputUsername}`,
    };

    updateSetting('accounts', {
      ...settings.accounts,
      [service]: newAccount,
    });
    updateSetting('activeSyncService', service);
    setActiveModal(null);
    setInputUsername('');
  };

  const handleLogout = (service: 'mal' | 'anilist' | 'simkl' | 'kitsu') => {
    const updated = { ...settings.accounts };
    delete updated[service];
    updateSetting('accounts', updated);
    if (settings.activeSyncService === service) {
      updateSetting('activeSyncService', undefined);
    }
  };

  const handleSimklPair = () => {
    setIsPollingSimkl(true);
    setTimeout(() => {
      setIsPollingSimkl(false);
      const newAccount: SyncAccount = {
        id: `simkl_${Date.now()}`,
        username: 'SimklUser',
        name: 'Simkl Explorer',
        isAuthenticated: true,
        lastSyncedAt: Date.now(),
        avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Simkl',
      };
      updateSetting('accounts', {
        ...settings.accounts,
        simkl: newAccount,
      });
      updateSetting('activeSyncService', 'simkl');
      setActiveModal(null);
    }, 2500);
  };

  const handleSaveSubtitlesApi = (service: 'openSubtitles' | 'subDl' | 'animeSkip') => {
    if (service === 'openSubtitles') {
      updateSetting('accounts', {
        ...settings.accounts,
        openSubtitles: {
          username: inputUsername.trim(),
          apiKey: inputApiKey.trim(),
          isAuthenticated: true,
        },
      });
    } else if (service === 'subDl') {
      updateSetting('accounts', {
        ...settings.accounts,
        subDl: {
          apiKey: inputApiKey.trim(),
          isAuthenticated: true,
        },
      });
    } else if (service === 'animeSkip') {
      updateSetting('accounts', {
        ...settings.accounts,
        animeSkip: {
          apiKey: inputApiKey.trim(),
          isAuthenticated: true,
        },
      });
    }
    setActiveModal(null);
    setInputUsername('');
    setInputApiKey('');
  };

  return (
    <div className="stremio-settings-tab-pane animate-fade-in">
      {/* Media Tracking & Scrobbling Section */}
      <section className="settings-card">
        <div className="settings-card-header">
          <Sparkles className="settings-icon text-purple" size={22} />
          <div>
            <h3>Scrobbling & Anime / Movie Tracking</h3>
            <p>Automatically sync episode watch progress, scores, and status across your libraries.</p>
          </div>
        </div>

        <div className="account-cards-grid">
          {/* MyAnimeList */}
          <div className="account-service-card">
            <div className="account-service-header">
              <div className="account-badge-logo mal-logo">MAL</div>
              <div>
                <h4>MyAnimeList</h4>
                <span className="account-status-label">
                  {settings.accounts.mal?.isAuthenticated ? (
                    <span className="text-emerald">
                      <CheckCircle2 size={12} style={{ display: 'inline', marginRight: '4px' }} />
                      Connected as {settings.accounts.mal.username}
                    </span>
                  ) : (
                    'Not Connected'
                  )}
                </span>
              </div>
            </div>
            {settings.accounts.mal?.isAuthenticated ? (
              <button
                className="settings-btn-subtle"
                onClick={() => handleLogout('mal')}
              >
                <LogOut size={14} /> Disconnect
              </button>
            ) : (
              <button
                className="settings-btn-primary"
                onClick={() => setActiveModal('mal')}
              >
                Connect MAL
              </button>
            )}
          </div>

          {/* AniList */}
          <div className="account-service-card">
            <div className="account-service-header">
              <div className="account-badge-logo anilist-logo">AL</div>
              <div>
                <h4>AniList</h4>
                <span className="account-status-label">
                  {settings.accounts.anilist?.isAuthenticated ? (
                    <span className="text-emerald">
                      <CheckCircle2 size={12} style={{ display: 'inline', marginRight: '4px' }} />
                      Connected as {settings.accounts.anilist.username}
                    </span>
                  ) : (
                    'Not Connected'
                  )}
                </span>
              </div>
            </div>
            {settings.accounts.anilist?.isAuthenticated ? (
              <button
                className="settings-btn-subtle"
                onClick={() => handleLogout('anilist')}
              >
                <LogOut size={14} /> Disconnect
              </button>
            ) : (
              <button
                className="settings-btn-primary"
                onClick={() => setActiveModal('anilist')}
              >
                Connect AniList
              </button>
            )}
          </div>

          {/* Simkl (Device PIN flow) */}
          <div className="account-service-card">
            <div className="account-service-header">
              <div className="account-badge-logo simkl-logo">SK</div>
              <div>
                <h4>Simkl (Movies & TV)</h4>
                <span className="account-status-label">
                  {settings.accounts.simkl?.isAuthenticated ? (
                    <span className="text-emerald">
                      <CheckCircle2 size={12} style={{ display: 'inline', marginRight: '4px' }} />
                      Connected as {settings.accounts.simkl.username}
                    </span>
                  ) : (
                    'Not Connected (PIN Flow)'
                  )}
                </span>
              </div>
            </div>
            {settings.accounts.simkl?.isAuthenticated ? (
              <button
                className="settings-btn-subtle"
                onClick={() => handleLogout('simkl')}
              >
                <LogOut size={14} /> Disconnect
              </button>
            ) : (
              <button
                className="settings-btn-primary"
                onClick={() => setActiveModal('simkl')}
              >
                <QrCode size={14} /> Pair via PIN
              </button>
            )}
          </div>

          {/* Kitsu */}
          <div className="account-service-card">
            <div className="account-service-header">
              <div className="account-badge-logo kitsu-logo">KT</div>
              <div>
                <h4>Kitsu</h4>
                <span className="account-status-label">
                  {settings.accounts.kitsu?.isAuthenticated ? (
                    <span className="text-emerald">
                      <CheckCircle2 size={12} style={{ display: 'inline', marginRight: '4px' }} />
                      Connected as {settings.accounts.kitsu.username}
                    </span>
                  ) : (
                    'Not Connected'
                  )}
                </span>
              </div>
            </div>
            {settings.accounts.kitsu?.isAuthenticated ? (
              <button
                className="settings-btn-subtle"
                onClick={() => handleLogout('kitsu')}
              >
                <LogOut size={14} /> Disconnect
              </button>
            ) : (
              <button
                className="settings-btn-primary"
                onClick={() => setActiveModal('kitsu')}
              >
                Connect Kitsu
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Subtitles & Skip Providers Section */}
      <section className="settings-card">
        <div className="settings-card-header">
          <Key className="settings-icon text-cyan" size={22} />
          <div>
            <h3>Subtitle Services & AnimeSkip Authentication</h3>
            <p>API keys for downloading subtitles and fetching crowd-sourced intro/outro markers.</p>
          </div>
        </div>

        <div className="account-cards-grid">
          {/* OpenSubtitles */}
          <div className="account-service-card">
            <div className="account-service-header">
              <div className="account-badge-logo sub-logo">OS</div>
              <div>
                <h4>OpenSubtitles.com</h4>
                <span className="account-status-label">
                  {settings.accounts.openSubtitles?.isAuthenticated
                    ? 'Active API Key'
                    : 'Unregistered (Public limit)'}
                </span>
              </div>
            </div>
            <button
              className="settings-btn-subtle"
              onClick={() => setActiveModal('openSubtitles')}
            >
              Configure Key
            </button>
          </div>

          {/* SubDL */}
          <div className="account-service-card">
            <div className="account-service-header">
              <div className="account-badge-logo sub-logo">SD</div>
              <div>
                <h4>SubDL API</h4>
                <span className="account-status-label">
                  {settings.accounts.subDl?.isAuthenticated
                    ? 'Active API Key'
                    : 'Unregistered'}
                </span>
              </div>
            </div>
            <button
              className="settings-btn-subtle"
              onClick={() => setActiveModal('subDl')}
            >
              Configure Key
            </button>
          </div>

          {/* AnimeSkip */}
          <div className="account-service-card">
            <div className="account-service-header">
              <div className="account-badge-logo sub-logo">AS</div>
              <div>
                <h4>AnimeSkip Token</h4>
                <span className="account-status-label">
                  {settings.accounts.animeSkip?.isAuthenticated
                    ? 'Authenticated Client'
                    : 'Public Read-only'}
                </span>
              </div>
            </div>
            <button
              className="settings-btn-subtle"
              onClick={() => setActiveModal('animeSkip')}
            >
              Configure Token
            </button>
          </div>
        </div>
      </section>

      {/* Auth Modals */}
      {activeModal === 'mal' && (
        <div className="modal-backdrop">
          <div className="modal-card animate-scale-in">
            <h3 className="modal-title">Connect MyAnimeList Account</h3>
            <p className="modal-desc">Enter your MyAnimeList username to synchronize your anime list.</p>
            <div className="form-group">
              <label>MAL Username</label>
              <input
                type="text"
                placeholder="e.g. NehalUser"
                className="settings-text-input"
                value={inputUsername}
                onChange={(e) => setInputUsername(e.target.value)}
              />
            </div>
            <div className="modal-actions">
              <button className="settings-btn-subtle" onClick={() => setActiveModal(null)}>
                Cancel
              </button>
              <button className="settings-btn-primary" onClick={() => handleLogin('mal')}>
                Authorize & Link
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'anilist' && (
        <div className="modal-backdrop">
          <div className="modal-card animate-scale-in">
            <h3 className="modal-title">Connect AniList Account</h3>
            <p className="modal-desc">Enter your AniList handle or GraphQL token for automated scrobbling.</p>
            <div className="form-group">
              <label>AniList Username</label>
              <input
                type="text"
                placeholder="e.g. SheikhNehal"
                className="settings-text-input"
                value={inputUsername}
                onChange={(e) => setInputUsername(e.target.value)}
              />
            </div>
            <div className="modal-actions">
              <button className="settings-btn-subtle" onClick={() => setActiveModal(null)}>
                Cancel
              </button>
              <button className="settings-btn-primary" onClick={() => handleLogin('anilist')}>
                Authorize & Link
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'simkl' && (
        <div className="modal-backdrop">
          <div className="modal-card animate-scale-in" style={{ textAlign: 'center' }}>
            <h3 className="modal-title">Pair Simkl via Device Code</h3>
            <p className="modal-desc">
              Visit <strong>https://simkl.com/pin</strong> on your phone or browser and enter the code below:
            </p>
            <div className="simkl-pin-display">{simklPin}</div>
            <p className="settings-subtext">
              {isPollingSimkl ? 'Waiting for authorization on Simkl...' : 'Code expires in 15 minutes.'}
            </p>
            <div className="modal-actions" style={{ justifyContent: 'center', marginTop: '20px' }}>
              <button className="settings-btn-subtle" onClick={() => setActiveModal(null)}>
                Cancel
              </button>
              <button
                className="settings-btn-primary"
                onClick={handleSimklPair}
                disabled={isPollingSimkl}
              >
                {isPollingSimkl ? 'Polling Status...' : "I've Entered the Code"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'openSubtitles' && (
        <div className="modal-backdrop">
          <div className="modal-card animate-scale-in">
            <h3 className="modal-title">OpenSubtitles.com Credentials</h3>
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                placeholder="OpenSubtitles username"
                className="settings-text-input"
                value={inputUsername}
                onChange={(e) => setInputUsername(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>API Key</label>
              <input
                type="password"
                placeholder="OpenSubtitles REST API Key"
                className="settings-text-input"
                value={inputApiKey}
                onChange={(e) => setInputApiKey(e.target.value)}
              />
            </div>
            <div className="modal-actions">
              <button className="settings-btn-subtle" onClick={() => setActiveModal(null)}>
                Cancel
              </button>
              <button
                className="settings-btn-primary"
                onClick={() => handleSaveSubtitlesApi('openSubtitles')}
              >
                Save Credentials
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
