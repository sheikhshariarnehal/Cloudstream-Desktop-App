import React, { useState, useEffect, useRef } from 'react';
import { X, Check, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { ExtensionInfo, TvType } from '../../types';

interface SearchFilterDropdownProps {
  extensions: ExtensionInfo[];
  selectedProviders: string[];
  onClose: () => void;
  onApply: (providers: string[]) => void;
}

function getFlagFromLang(lang?: string): string {
  if (!lang) return '🌐';
  const l = lang.toLowerCase();
  if (l.includes('en') || l.includes('us')) return '🇺🇸';
  if (l.includes('bn') || l.includes('bd')) return '🇧🇩';
  if (l.includes('ja') || l.includes('jp')) return '🇯🇵';
  if (l.includes('hi') || l.includes('in')) return '🇮🇳';
  if (l.includes('ko') || l.includes('kr')) return '🇰🇷';
  if (l.includes('es')) return '🇪🇸';
  if (l.includes('fr')) return '🇫🇷';
  if (l.includes('de')) return '🇩🇪';
  if (l.includes('zh') || l.includes('cn')) return '🇨🇳';
  return '🌐';
}

export const SearchFilterDropdown: React.FC<SearchFilterDropdownProps> = ({
  extensions,
  selectedProviders,
  onClose,
  onApply,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const realExtensions = extensions.filter((e) => e.id !== 'all');

  const [activeSelection, setActiveSelection] = useState<string[]>(() => {
    if (selectedProviders.length === 0) {
      return realExtensions.map((e) => e.name);
    }
    return selectedProviders;
  });

  const [filterType, setFilterType] = useState<TvType | 'All'>('All');

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const toggleProvider = (name: string) => {
    setActiveSelection((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleSelectAll = () => {
    setActiveSelection(realExtensions.map((e) => e.name));
  };

  const handleDeselectAll = () => {
    setActiveSelection([]);
  };

  const filteredExtensions = realExtensions.filter((ext) => {
    if (filterType === 'All') return true;
    return ext.supported_types.some(
      (t) => t.toLowerCase() === filterType.toLowerCase()
    );
  });

  const handleSave = () => {
    if (activeSelection.length === realExtensions.length) {
      onApply([]);
    } else {
      onApply(activeSelection);
    }
    onClose();
  };

  return (
    <div
      ref={dropdownRef}
      className="search-filter-dropdown-overlay"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="search-filter-dropdown-header">
        <div className="filter-dropdown-title-wrap">
          <SlidersHorizontal size={15} color="#a78bfa" />
          <span className="filter-dropdown-title">Search Sources</span>
          <span className="filter-dropdown-count-badge">
            {activeSelection.length} / {realExtensions.length}
          </span>
        </div>

        <button
          type="button"
          className="filter-dropdown-close-btn"
          onClick={onClose}
          title="Close (Esc)"
        >
          <X size={14} />
        </button>
      </div>

      {/* TvType Pills & Quick Actions */}
      <div className="filter-dropdown-type-bar">
        <div className="filter-dropdown-pills">
          {(['All', 'Movie', 'TvSeries', 'Anime'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              className={`filter-type-pill ${filterType === cat ? 'active' : ''}`}
              onClick={() => setFilterType(cat as any)}
            >
              {cat === 'TvSeries' ? 'Series' : cat}
            </button>
          ))}
        </div>

        <div className="filter-dropdown-quick-actions">
          <button type="button" className="filter-quick-link" onClick={handleSelectAll}>
            All
          </button>
          <span className="filter-quick-divider">•</span>
          <button type="button" className="filter-quick-link" onClick={handleDeselectAll}>
            Clear
          </button>
        </div>
      </div>

      {/* Extensions List */}
      <div className="filter-dropdown-list">
        {filteredExtensions.length === 0 ? (
          <div className="filter-dropdown-empty">
            No sources found for category "{filterType}".
          </div>
        ) : (
          filteredExtensions.map((ext) => {
            const isChecked = activeSelection.includes(ext.name);
            return (
              <div
                key={ext.id}
                className={`filter-dropdown-item ${isChecked ? 'selected' : ''}`}
                onClick={() => toggleProvider(ext.name)}
              >
                <div className="filter-ext-left">
                  <div className={`filter-checkbox ${isChecked ? 'checked' : ''}`}>
                    {isChecked && <Check size={12} strokeWidth={3} />}
                  </div>

                  <span className="filter-ext-flag" title="Language">
                    {getFlagFromLang(ext.description || ext.name)}
                  </span>

                  <div className="filter-ext-info">
                    <div className="filter-ext-name">{ext.name}</div>
                    <div className="filter-ext-types">
                      {ext.supported_types.slice(0, 3).join(', ')}
                    </div>
                  </div>
                </div>

                {ext.version && (
                  <span className="filter-ext-ver">{ext.version}</span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Actions */}
      <div className="search-filter-dropdown-footer">
        <button
          type="button"
          className="filter-dropdown-reset-btn"
          onClick={handleSelectAll}
          title="Reset to all sources"
        >
          <RotateCcw size={12} />
          <span>Reset</span>
        </button>

        <div className="filter-dropdown-footer-right">
          <button
            type="button"
            className="filter-dropdown-cancel-btn"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="filter-dropdown-apply-btn"
            onClick={handleSave}
          >
            Apply Sources
          </button>
        </div>
      </div>
    </div>
  );
};
