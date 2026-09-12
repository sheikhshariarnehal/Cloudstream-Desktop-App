import React from 'react';
import { Compass, Puzzle, Settings, Play, Search } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  return (
    <aside className="sidebar">
      {/* Stremio 45-degree Diamond Logo */}
      <div className="sidebar-logo" title="CloudStream" onClick={() => setActiveTab('home')}>
        <div className="stremio-diamond">
          <Play size={15} color="#fff" fill="#fff" className="diamond-play-icon" />
        </div>
      </div>

      <nav className="nav-items">
        {/* Home */}
        <button
          className={`nav-btn ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => setActiveTab('home')}
          title="Home Board"
        >
          {/* Exact Stremio Home Icon (Silhouette when active) */}
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill={activeTab === 'home' ? 'var(--stremio-purple-light)' : 'none'}
            stroke={activeTab === 'home' ? 'var(--stremio-purple-light)' : 'currentColor'}
            strokeWidth={activeTab === 'home' ? '0' : '2.0'}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {activeTab === 'home' ? (
              <path d="M3 10.182V20a1 1 0 0 0 1 1h5v-6h6v6h5a1 1 0 0 0 1-1v-9.818a1 1 0 0 0-.356-.767l-8-6.857a1 1 0 0 0-1.288 0l-8 6.857A1 1 0 0 0 3 10.182z" />
            ) : (
              <>
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </>
            )}
          </svg>
        </button>

        {/* Search */}
        <button
          className={`nav-btn ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
          title="Search Catalog"
        >
          <Search size={28} strokeWidth={2.0} />
        </button>

        {/* Discover */}
        <button
          className={`nav-btn ${activeTab === 'discover' ? 'active' : ''}`}
          onClick={() => setActiveTab('discover')}
          title="Discover Catalog"
        >
          <Compass size={28} strokeWidth={2.0} />
        </button>

        {/* Library (Exact Stremio Stack of Binders/Cards Icon) */}
        <button
          className={`nav-btn ${activeTab === 'library' ? 'active' : ''}`}
          onClick={() => setActiveTab('library')}
          title="Library & Watchlist"
        >
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.0"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 4h14" />
            <path d="M4 8h16" />
            <rect x="3" y="12" width="18" height="8" rx="2" />
          </svg>
        </button>

        {/* Calendar (Exact Stremio Dotted Calendar) */}
        <button
          className={`nav-btn ${activeTab === 'calendar' ? 'active' : ''}`}
          onClick={() => setActiveTab('calendar')}
          title="Calendar / Schedule"
        >
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.0"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <circle cx="8" cy="14" r="1.15" fill="currentColor" />
            <circle cx="12" cy="14" r="1.15" fill="currentColor" />
            <circle cx="16" cy="14" r="1.15" fill="currentColor" />
            <circle cx="8" cy="18" r="1.15" fill="currentColor" />
            <circle cx="12" cy="18" r="1.15" fill="currentColor" />
            <circle cx="16" cy="18" r="1.15" fill="currentColor" />
          </svg>
        </button>

        {/* Addons / Plugins */}
        <button
          className={`nav-btn ${activeTab === 'plugins' ? 'active' : ''}`}
          onClick={() => setActiveTab('plugins')}
          title="CloudStream Addons & Extensions"
        >
          <Puzzle size={30} strokeWidth={2.0} />
        </button>
      </nav>

      {/* Settings at the bottom */}
      <div className="sidebar-footer">
        <button
          className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
          title="Settings"
        >
          <Settings size={30} strokeWidth={2.0} />
        </button>
      </div>
    </aside>
  );
};
