import React from 'react';
import { Compass, Puzzle, Settings, Search } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  return (
    <aside className="sidebar">
      {/* CloudStream Logo */}
      <div className="sidebar-logo" title="CloudStream" onClick={() => setActiveTab('home')}>
        <div className="cloudstream-app-logo">
          <svg viewBox="87.47 175.83 337.05 160.34" width="34" height="22" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g id="surface1">
              <path style={{ stroke: 'none', fillRule: 'nonzero', fill: '#4c1d95', fillOpacity: 1 }} d="M 389.027344 265.0625 C 385.425781 265.054688 381.847656 265.605469 378.414062 266.679688 C 376.308594 255.726562 370.59375 245.789062 362.167969 238.46875 C 353.761719 231.152344 343.128906 226.855469 331.992188 226.292969 C 325.902344 209.5625 314.179688 195.46875 298.847656 186.441406 C 283.511719 177.402344 265.5 173.984375 247.921875 176.773438 C 230.347656 179.5625 214.277344 188.378906 202.488281 201.710938 C 189.679688 197.378906 175.777344 197.480469 163.035156 202.003906 C 150.296875 206.527344 139.445312 215.214844 132.234375 226.652344 C 125.027344 238.089844 121.882812 251.625 123.300781 265.070312 L 122.964844 265.070312 C 113.554688 265.070312 104.523438 268.816406 97.871094 275.46875 C 91.210938 282.121094 87.472656 291.15625 87.472656 300.570312 C 87.472656 309.980469 91.210938 319.007812 97.871094 325.660156 C 104.523438 332.320312 113.554688 336.058594 122.964844 336.058594 L 389.027344 336.058594 C 398.4375 336.058594 407.46875 332.320312 414.125 325.660156 C 420.777344 319.007812 424.519531 309.980469 424.519531 300.570312 C 424.519531 291.15625 420.777344 282.121094 414.125 275.46875 C 407.46875 268.816406 398.4375 265.070312 389.027344 265.070312 Z M 389.027344 265.0625 " />
              <path style={{ stroke: 'none', fillRule: 'nonzero', fill: '#7c3aed', fillOpacity: 1 }} d="M 342.214844 234.804688 C 342.214844 232.519531 342.132812 230.246094 342.046875 227.984375 C 338.761719 227.113281 335.386719 226.578125 331.992188 226.394531 C 325.902344 209.667969 314.179688 195.570312 298.847656 186.542969 C 283.511719 177.503906 265.5 174.085938 247.921875 176.875 C 230.347656 179.664062 214.277344 188.480469 202.488281 201.8125 C 189.679688 197.480469 175.777344 197.585938 163.035156 202.105469 C 150.296875 206.628906 139.445312 215.316406 132.234375 226.753906 C 125.027344 238.191406 121.882812 251.730469 123.300781 265.171875 L 122.964844 265.171875 C 113.554688 265.171875 104.523438 268.917969 97.871094 275.570312 C 91.210938 282.222656 87.472656 291.261719 87.472656 300.671875 C 87.472656 310.082031 91.210938 319.113281 97.871094 325.765625 C 104.523438 332.421875 113.554688 336.164062 122.964844 336.164062 L 304.175781 336.164062 C 328.734375 308.121094 342.257812 272.082031 342.214844 234.804688 Z M 342.214844 234.804688 " />
              <path style={{ stroke: 'none', fillRule: 'nonzero', fill: '#a855f7', fillOpacity: 1 }} d="M 202.488281 201.8125 C 189.679688 197.480469 175.777344 197.585938 163.035156 202.105469 C 150.296875 206.628906 139.445312 215.316406 132.234375 226.753906 C 125.027344 238.089844 121.882812 251.730469 123.300781 265.171875 L 122.964844 265.171875 C 113.773438 265.207031 104.941406 268.808594 98.355469 275.21875 C 91.761719 281.636719 87.910156 290.359375 87.625 299.550781 C 87.339844 308.742188 90.632812 317.691406 96.816406 324.496094 C 102.992188 331.3125 111.585938 335.453125 120.753906 336.058594 C 160.578125 334.917969 198.417969 318.285156 226.175781 289.714844 C 253.9375 261.148438 269.488281 222.847656 269.488281 183.007812 C 269.488281 180.847656 269.417969 178.703125 269.320312 176.589844 C 266.203125 176.179688 263.0625 175.960938 259.917969 175.945312 C 249.058594 175.929688 238.324219 178.234375 228.414062 182.691406 C 218.511719 187.15625 209.671875 193.675781 202.488281 201.8125 Z M 202.488281 201.8125 " />
            </g>
          </svg>
        </div>
      </div>

      <nav className="nav-items">
        {/* Home / Board */}
        <button
          className={`nav-btn ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => setActiveTab('home')}
          aria-label="Board"
        >
          <div className="nav-icon-wrap">
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {activeTab === 'home' ? (
                <>
                  <path
                    d="M2.5 11.5L12 3l9.5 8.5"
                    stroke="currentColor"
                    strokeWidth="2.3"
                  />
                  <path
                    d="M5.5 10.5L12 4.8l6.5 5.7V20.5a.5.5 0 0 1-.5.5H14.5V14.5a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 0-.5.5V21H6a.5.5 0 0 1-.5-.5V10.5z"
                    fill="currentColor"
                    stroke="none"
                  />
                </>
              ) : (
                <>
                  <path
                    d="M2.5 11.5L12 3l9.5 8.5"
                    stroke="currentColor"
                    strokeWidth="2.1"
                  />
                  <path
                    d="M5.5 10.5V20.5a.5.5 0 0 0 .5.5h3.5V14.5a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 .5.5V21h3.5a.5.5 0 0 0 .5-.5V10.5"
                    stroke="currentColor"
                    strokeWidth="2.1"
                    fill="none"
                  />
                </>
              )}
            </svg>
          </div>
          <span className="nav-label">Board</span>
        </button>

        {/* Search */}
        <button
          className={`nav-btn ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
          aria-label="Search"
        >
          <div className="nav-icon-wrap">
            <Search size={29} strokeWidth={activeTab === 'search' ? 2.5 : 2.1} />
          </div>
          <span className="nav-label">Search</span>
        </button>

        {/* Discover */}
        <button
          className={`nav-btn ${activeTab === 'discover' ? 'active' : ''}`}
          onClick={() => setActiveTab('discover')}
          aria-label="Discover"
        >
          <div className="nav-icon-wrap">
            <Compass size={29} strokeWidth={activeTab === 'discover' ? 2.5 : 2.1} />
          </div>
          <span className="nav-label">Discover</span>
        </button>

        {/* Library */}
        <button
          className={`nav-btn ${activeTab === 'library' ? 'active' : ''}`}
          onClick={() => setActiveTab('library')}
          aria-label="Library"
        >
          <div className="nav-icon-wrap">
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={activeTab === 'library' ? '2.3' : '2.1'}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 4h14" />
              <path d="M4 8h16" />
              <rect
                x="3"
                y="12"
                width="18"
                height="8"
                rx="2"
                fill={activeTab === 'library' ? 'currentColor' : 'none'}
              />
            </svg>
          </div>
          <span className="nav-label">Library</span>
        </button>

        {/* Addons / Plugins */}
        <button
          className={`nav-btn ${activeTab === 'plugins' ? 'active' : ''}`}
          onClick={() => setActiveTab('plugins')}
          aria-label="Addons"
        >
          <div className="nav-icon-wrap">
            <Puzzle size={29} strokeWidth={activeTab === 'plugins' ? 2.5 : 2.1} />
          </div>
          <span className="nav-label">Addons</span>
        </button>
      </nav>

      {/* Settings at the bottom */}
      <div className="sidebar-footer">
        <button
          className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
          aria-label="Settings"
        >
          <div className="nav-icon-wrap">
            <Settings size={29} strokeWidth={activeTab === 'settings' ? 2.5 : 2.1} />
          </div>
          <span className="nav-label">Settings</span>
        </button>
      </div>
    </aside>
  );
};
