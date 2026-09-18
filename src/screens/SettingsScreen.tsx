import React, { useState, useEffect, useRef } from 'react';
import { GeneralTab } from './settings/tabs/GeneralTab';
import { AppearanceTab } from './settings/tabs/AppearanceTab';
import { PlayerTab } from './settings/tabs/PlayerTab';
import { StreamingTab } from './settings/tabs/StreamingTab';
import { SubtitlesTab } from './settings/tabs/SubtitlesTab';
import { ProvidersTab } from './settings/tabs/ProvidersTab';
import { AccountsTab } from './settings/tabs/AccountsTab';
import { ShortcutsTab } from './settings/tabs/ShortcutsTab';
import { UpdatesBackupTab } from './settings/tabs/UpdatesBackupTab';
import { DiagnosticsTab } from './settings/tabs/DiagnosticsTab';
import { trackScreen } from '../utils/openpulse';

interface NavItem {
  id: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'general', label: 'General' },
  { id: 'interface', label: 'Interface' },
  { id: 'player', label: 'Player' },
  { id: 'streaming', label: 'Streaming' },
  { id: 'subtitles', label: 'Subtitles' },
  { id: 'providers', label: 'Providers' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'shortcuts', label: 'Shortcuts' },
  { id: 'backup', label: 'Backup & Updates' },
  { id: 'diagnostics', label: 'Diagnostics' },
];

export const SettingsScreen: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('interface');
  const [copied, setCopied] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const isClickScrolling = useRef(false);

  // OpenPulse Telemetry: Track Settings Screen & Section Views
  useEffect(() => {
    trackScreen('/settings', { section: activeSection });
  }, [activeSection]);

  const appVersion = '6.0.1-beta.09';
  const buildVersion = '6ed4463d94ba...';
  const serverVersion = '4.21.0';
  const shellVersion = '5.0.25';

  const handleCopyBuild = () => {
    const text = `App Version: ${appVersion}\nBuild Version: ${buildVersion}\nServer Version: ${serverVersion}\nShell Version: ${shellVersion}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    isClickScrolling.current = true;
    const target = document.getElementById(`settings-section-${id}`);
    if (target && viewportRef.current) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setTimeout(() => {
      isClickScrolling.current = false;
    }, 800);
  };

  useEffect(() => {
    const container = viewportRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (isClickScrolling.current) return;
      const scrollPos = container.scrollTop + 140;

      for (let i = NAV_ITEMS.length - 1; i >= 0; i--) {
        const item = NAV_ITEMS[i];
        const el = document.getElementById(`settings-section-${item.id}`);
        if (el && el.offsetTop <= scrollPos) {
          setActiveSection(item.id);
          break;
        }
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="stremio-settings-container animate-fade-in">
      {/* Left Sub-Navigation Sidebar */}
      <aside className="stremio-settings-sidebar">
        <nav className="stremio-settings-nav">
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                className={`stremio-settings-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => scrollToSection(item.id)}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* 4-Line Monospace Version Block (Stremio Exact) */}
        <div
          className="stremio-settings-version-block"
          onClick={handleCopyBuild}
          title="Click to copy version details"
        >
          <div>App Version: {appVersion}</div>
          <div>Build Version: {buildVersion}</div>
          <div>Server Version: {serverVersion}</div>
          <div>Shell Version: {shellVersion}</div>
          {copied && (
            <div style={{ color: '#10b981', marginTop: '4px', fontSize: '11px' }}>
              Copied to clipboard!
            </div>
          )}
        </div>
      </aside>

      {/* Right Continuous Settings Viewport */}
      <main className="stremio-settings-viewport" ref={viewportRef}>
        <div className="stremio-settings-sections">
          {/* General */}
          <section id="settings-section-general" className="stremio-section">
            <h2 className="stremio-section-title">General</h2>
            <GeneralTab />
          </section>

          {/* Interface */}
          <section id="settings-section-interface" className="stremio-section">
            <h2 className="stremio-section-title">Interface</h2>
            <AppearanceTab />
          </section>

          {/* Player */}
          <section id="settings-section-player" className="stremio-section">
            <h2 className="stremio-section-title">Player</h2>
            <PlayerTab />
          </section>

          {/* Streaming */}
          <section id="settings-section-streaming" className="stremio-section">
            <h2 className="stremio-section-title">Streaming</h2>
            <StreamingTab />
          </section>

          {/* Subtitles */}
          <section id="settings-section-subtitles" className="stremio-section">
            <h2 className="stremio-section-title">Subtitles</h2>
            <SubtitlesTab />
          </section>

          {/* Providers */}
          <section id="settings-section-providers" className="stremio-section">
            <h2 className="stremio-section-title">Providers</h2>
            <ProvidersTab />
          </section>

          {/* Accounts */}
          <section id="settings-section-accounts" className="stremio-section">
            <h2 className="stremio-section-title">Accounts</h2>
            <AccountsTab />
          </section>

          {/* Shortcuts */}
          <section id="settings-section-shortcuts" className="stremio-section">
            <h2 className="stremio-section-title">Shortcuts</h2>
            <ShortcutsTab />
          </section>

          {/* Backup & Updates */}
          <section id="settings-section-backup" className="stremio-section">
            <h2 className="stremio-section-title">Backup & Updates</h2>
            <UpdatesBackupTab />
          </section>

          {/* Diagnostics */}
          <section id="settings-section-diagnostics" className="stremio-section">
            <h2 className="stremio-section-title">Diagnostics</h2>
            <DiagnosticsTab />
          </section>
        </div>
      </main>
    </div>
  );
};

