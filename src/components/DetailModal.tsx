import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Episode, ExtractorLink, LoadResponse, SearchResponse } from '../types';
import { ChevronLeft, Play, Plus, Check, Clock, Calendar, Server } from 'lucide-react';

interface DetailModalProps {
  item: SearchResponse;
  onClose: () => void;
  onPlay: (item: SearchResponse, episode: Episode, links: ExtractorLink[]) => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({ item, onClose, onPlay }) => {
  const [details, setDetails] = useState<LoadResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [extracting, setExtracting] = useState<number | null>(null);

  useEffect(() => {
    async function fetchDetails() {
      setLoading(true);
      try {
        const res: LoadResponse = await invoke('load_media', {
          provider: item.api_name,
          url: item.url,
        });
        setDetails(res);
      } catch (err) {
        console.error('Failed to load media details:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDetails();
  }, [item]);

  const handlePlayEpisode = async (ep: Episode) => {
    setExtracting(ep.episode);
    try {
      const links: ExtractorLink[] = await invoke('load_links', {
        provider: item.api_name,
        data: ep.data,
      });
      if (links.length > 0) {
        onPlay(item, ep, links);
      } else {
        alert('No playable links found for this source.');
      }
    } catch (err) {
      console.error('Failed to extract stream links:', err);
      alert('Error extracting video links: ' + err);
    } finally {
      setExtracting(null);
    }
  };

  const handleToggleWatchlist = async () => {
    try {
      if (isWatchlisted) {
        await invoke('remove_watchlist_item', { mediaId: item.url });
        setIsWatchlisted(false);
      } else {
        await invoke('set_watchlist_item', {
          item: {
            media_id: item.url,
            provider_id: item.api_name,
            title: item.name,
            poster_url: item.poster_url,
            tv_type: item.tv_type,
            status: 'watching',
            score: item.score,
            added_at: Date.now(),
          },
        });
        setIsWatchlisted(true);
      }
    } catch (e) {
      console.error('Watchlist error:', e);
    }
  };

  // Group episodes by season
  const seasons = details?.episodes
    ? Array.from(new Set(details.episodes.map((e) => e.season || 1))).sort((a, b) => a - b)
    : [1];

  const currentEpisodes = details?.episodes
    ? details.episodes.filter((e) => (e.season || 1) === selectedSeason)
    : [];

  return (
    <div className="detail-modal-overlay">
      <div className="detail-modal">
        {/* Floating Back Button */}
        <button 
          className="modal-close" 
          onClick={onClose}
          title="Back to Catalog"
        >
          <ChevronLeft size={22} style={{ marginRight: '2px', display: 'block' }} />
        </button>

        {loading ? (
          <div style={{ padding: '160px 40px', textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: '20px', fontWeight: 600 }}>Loading media details from {item.api_name}...</div>
          </div>
        ) : details ? (
          <div style={{ paddingBottom: '60px' }}>
            {/* Header backdrop */}
            <div style={{ position: 'relative', height: '420px', overflow: 'hidden' }}>
              <img
                src={details.background_poster_url || details.poster_url}
                alt={details.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.45)' }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(0deg, #0d0b1a 0%, rgba(13, 11, 26, 0.75) 50%, rgba(13, 11, 26, 0.3) 100%)',
                }}
              />

              <div style={{ position: 'absolute', bottom: '32px', left: '48px', right: '48px', display: 'flex', gap: '32px', alignItems: 'flex-end', maxWidth: '1200px', margin: '0 auto' }}>
                <img
                  src={details.poster_url}
                  alt={details.name}
                  style={{
                    width: '160px',
                    height: '240px',
                    objectFit: 'cover',
                    borderRadius: '12px',
                    boxShadow: '0 12px 36px rgba(0,0,0,0.7)',
                    flexShrink: 0,
                  }}
                />

                <div style={{ flex: 1 }}>
                  {/* Genre / Tag Chips */}
                  {details.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                      {details.tags.map((t) => (
                        <span
                          key={t}
                          style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#a78bfa',
                            textTransform: 'capitalize',
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '34px', fontWeight: 800, color: '#fff', marginBottom: '10px', letterSpacing: '-0.3px' }}>
                    {details.name}
                  </h1>

                  {/* Metadata Row matching Hero banner */}
                  <div className="stremio-hero-meta-row">
                    {details.year && (
                      <span className="hero-meta-chip hero-year-chip">
                        <Calendar size={13} style={{ marginRight: '4px' }} /> {details.year}
                      </span>
                    )}
                    {details.duration_minutes && (
                      <span className="hero-meta-chip hero-quality-chip">
                        <Clock size={13} style={{ marginRight: '4px' }} /> {details.duration_minutes} min
                      </span>
                    )}
                    <span className="hero-meta-chip hero-provider-chip">
                      <Server size={13} style={{ marginRight: '4px' }} /> {details.api_name}
                    </span>
                  </div>

                  {/* Action Buttons matching Hero pills */}
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '16px' }}>
                    {details.episodes.length > 0 && (
                      <button
                        type="button"
                        className="stremio-hero-play-btn"
                        onClick={() => handlePlayEpisode(details.episodes[0])}
                        disabled={extracting !== null}
                      >
                        <Play size={18} fill="#ffffff" color="#ffffff" style={{ marginLeft: '2px' }} />
                        <span>{extracting !== null ? 'Extracting Streams...' : 'Play Now'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className={`stremio-hero-watchlist-btn ${isWatchlisted ? 'active' : ''}`}
                      onClick={handleToggleWatchlist}
                      title={isWatchlisted ? 'Remove from Library' : 'Add to Library'}
                    >
                      {isWatchlisted ? <Check size={18} /> : <Plus size={18} />}
                      <span>{isWatchlisted ? 'In Library' : 'Library'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Synopsis, Cast & Episodes */}
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 48px', width: '100%', boxSizing: 'border-box' }}>
              <div style={{ marginBottom: '28px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px', color: '#ffffff' }}>Overview</h3>
                <p style={{ fontSize: '14.5px', lineHeight: '1.7', color: '#94a3b8', maxWidth: '850px' }}>
                  {details.plot || 'No synopsis provided for this title.'}
                </p>
              </div>

              {/* Cast Row */}
              {details.cast.length > 0 && (
                <div style={{ marginBottom: '28px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px', color: '#ffffff' }}>Cast</h3>
                  <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px' }}>
                    {details.cast.map((actor) => (
                      <div key={actor.name} style={{ width: '85px', textAlign: 'center', flexShrink: 0 }}>
                        <img
                          src={actor.image || 'https://via.placeholder.com/100x100?text=Actor'}
                          alt={actor.name}
                          style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', margin: '0 auto 6px' }}
                        />
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {actor.name}
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>{actor.role || 'Cast'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Episodes Section */}
              {details.episodes.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#ffffff' }}>Episodes</h3>
                    {seasons.length > 1 && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {seasons.map((s) => (
                          <button
                            key={s}
                            className={`detail-season-tab${selectedSeason === s ? ' active' : ''}`}
                            onClick={() => setSelectedSeason(s)}
                          >
                            Season {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {currentEpisodes.map((ep) => (
                      <div
                        key={ep.episode}
                        className="detail-episode-card"
                        onClick={() => handlePlayEpisode(ep)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
                          <span className="detail-episode-number">
                            {ep.episode}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div className="detail-episode-title">
                              {ep.name || `Episode ${ep.episode}`}
                            </div>
                            {ep.description && (
                              <div className="detail-episode-sub">
                                {ep.description}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className={`detail-episode-icon-btn${extracting === ep.episode ? ' extracting' : ''}`}>
                          <Play size={16} fill={extracting === ep.episode ? 'var(--accent-cyan)' : 'currentColor'} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
