import React, { useState } from 'react';
import { X, Check, SlidersHorizontal, Puzzle } from 'lucide-react';
import { ExtensionInfo, TvType } from '../../types';

interface SearchFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  extensions: ExtensionInfo[];
  selectedProviders: string[];
  onApply: (providers: string[]) => void;
}

export const SearchFilterModal: React.FC<SearchFilterModalProps> = ({
  isOpen,
  onClose,
  extensions,
  selectedProviders,
  onApply,
}) => {
  const realExtensions = extensions.filter((e) => e.id !== 'all');

  const [activeSelection, setActiveSelection] = useState<string[]>(() => {
    if (selectedProviders.length === 0) {
      return realExtensions.map((e) => e.name);
    }
    return selectedProviders;
  });

  const [filterType, setFilterType] = useState<TvType | 'All'>('All');

  if (!isOpen) return null;

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
    // If all are selected, treat as empty set (meaning "all")
    if (activeSelection.length === realExtensions.length) {
      onApply([]);
    } else {
      onApply(activeSelection);
    }
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="search-filter-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '560px',
          maxWidth: '92vw',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div className="search-filter-dialog-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="filter-dialog-icon">
              <SlidersHorizontal size={18} color="var(--stremio-purple-light)" />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#fff' }}>
                Search Providers & Sources
              </h2>
              <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                Select which installed extensions are queried during search
              </span>
            </div>
          </div>

          <button className="modal-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Filter by TvType Bar */}
        <div className="filter-dialog-type-bar">
          {(['All', 'Movie', 'TvSeries', 'Anime'] as const).map((cat) => (
            <button
              key={cat}
              className={`filter-type-pill ${filterType === cat ? 'active' : ''}`}
              onClick={() => setFilterType(cat as any)}
            >
              {cat}
            </button>
          ))}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
            <button type="button" className="filter-quick-btn" onClick={handleSelectAll}>
              Select All
            </button>
            <button type="button" className="filter-quick-btn" onClick={handleDeselectAll}>
              Clear
            </button>
          </div>
        </div>

        {/* Extensions List */}
        <div className="filter-dialog-list">
          {filteredExtensions.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
              No installed extensions match the "{filterType}" category.
            </div>
          ) : (
            filteredExtensions.map((ext) => {
              const isChecked = activeSelection.includes(ext.name);
              return (
                <div
                  key={ext.id}
                  className={`filter-extension-item ${isChecked ? 'selected' : ''}`}
                  onClick={() => toggleProvider(ext.name)}
                >
                  <div className="filter-ext-left">
                    <div className="filter-checkbox">
                      {isChecked && <Check size={13} strokeWidth={3} />}
                    </div>

                    {ext.icon_url ? (
                      <img
                        src={ext.icon_url}
                        alt={ext.name}
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '5px',
                          objectFit: 'contain',
                          background: 'rgba(255,255,255,0.04)',
                          flexShrink: 0,
                          border: 'none',
                        }}
                        onError={(ev) => {
                          ev.currentTarget.style.display = 'none';
                          const sibling = ev.currentTarget.nextElementSibling as HTMLElement | null;
                          if (sibling) sibling.style.display = 'inline-flex';
                        }}
                      />
                    ) : null}
                    {/* Fallback icon shown only when image is absent or fails */}
                    <div
                      className="filter-ext-fallback-icon"
                      style={{
                        display: ext.icon_url ? 'none' : 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '22px',
                        height: '22px',
                        borderRadius: '5px',
                        background: 'rgba(124, 58, 237, 0.15)',
                        flexShrink: 0,
                      }}
                    >
                      <Puzzle size={12} color="var(--stremio-purple-light)" />
                    </div>

                    <div className="filter-ext-info">
                      <div className="filter-ext-name">{ext.name}</div>
                      <div className="filter-ext-types">
                        {ext.supported_types.slice(0, 3).join(', ')}
                        {ext.supported_types.length > 3 && ` +${ext.supported_types.length - 3}`}
                      </div>
                    </div>
                  </div>

                  <div className="filter-ext-right">
                    {ext.version && (
                      <span className="filter-ext-ver">{ext.version}</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="search-filter-dialog-footer">
          <div style={{ fontSize: '13px', color: '#94a3b8' }}>
            <strong style={{ color: '#fff' }}>{activeSelection.length}</strong> of{' '}
            {realExtensions.length} providers active
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={handleSave}>
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
