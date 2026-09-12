import React from 'react';
import { Home, Compass, Folder, Calendar, Puzzle, Settings, Play } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  return (
    <div className="sidebar">
      <div className="sidebar-logo" title="CloudStream" onClick={() => setActiveTab('home')}>
        <div className="stremio-diamond">
          <Play size={18} color="#fff" fill="#fff" style={{ transform: 'translateX(1px)' }} />
        </div>
      </div>

      <div className="nav-items">
        <button
          className={`nav-btn ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => setActiveTab('home')}
          title="Home Board"
        >
          <Home size={22} />
        </button>

        <button
          className={`nav-btn ${activeTab === 'discover' || activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('discover')}
          title="Discover Catalog"
        >
          <Compass size={22} />
        </button>

        <button
          className={`nav-btn ${activeTab === 'library' ? 'active' : ''}`}
          onClick={() => setActiveTab('library')}
          title="Library & Watchlist"
        >
          <Folder size={22} />
        </button>

        <button
          className={`nav-btn ${activeTab === 'calendar' ? 'active' : ''}`}
          onClick={() => setActiveTab('calendar')}
          title="Calendar / Schedule"
        >
          <Calendar size={22} />
        </button>

        <button
          className={`nav-btn ${activeTab === 'plugins' ? 'active' : ''}`}
          onClick={() => setActiveTab('plugins')}
          title="CloudStream Addons & Extensions"
        >
          <Puzzle size={22} />
        </button>
      </div>

      <div className="sidebar-footer">
        <button
          className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
          title="Settings"
        >
          <Settings size={22} />
        </button>
      </div>
    </div>
  );
};
