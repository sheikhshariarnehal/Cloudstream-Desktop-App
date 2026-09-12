import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Episode, ExtractorLink, LoadResponse, SearchResponse } from '../types';
import { ArrowLeft, Play, Plus, Check, Clock, Calendar, Server } from 'lucide-react';

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
          <ArrowLeft size={20} />
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
                  background: 'linear-gradient(0deg, var(--stremio-bg) 0%, rgba(14, 13, 26, 0.6) 50%, rgba(14, 13, 26, 0.2) 100%)',
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
                    boxShadow: '0 12px 36px rgba(0,0,0,0.8)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    flexShrink: 0,
                  }}
                />

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    {details.tags.map((t) => (
                      <span
                        key={t}
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          background: 'rgba(99, 102, 241, 0.2)',
                          color: '#c7d2fe',
                          padding: '3px 8px',
                          borderRadius: '6px',
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>

                  <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
                    {details.name}
                  </h1>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: '#94a3b8', fontSize: '13px', marginBottom: '14px' }}>
                    {details.year && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={14} /> {details.year}
                      </span>
                    )}
                    {details.duration_minutes && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={14} /> {details.duration_minutes} min
                      </span>
                    )}
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Server size={14} /> {details.api_name}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    {details.episodes.length > 0 && (
                      <button
                        className="btn-primary"
                        onClick={() => handlePlayEpisode(details.episodes[0])}
                        disabled={extracting !== null}
                      >
                        <Play size={16} fill="#fff" />
                        {extracting !== null ? 'Extracting Streams...' : 'Play Now'}
                      </button>
                    )}
                    <button className="btn-secondary" onClick={handleToggleWatchlist}>
                      {isWatchlisted ? <Check size={16} /> : <Plus size={16} />}
                      {isWatchlisted ? 'In Watchlist' : 'Watchlist'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Synopsis, Cast & Episodes */}
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 48px', width: '100%', boxSizing: 'border-box' }}>
              <div style={{ marginBottom: '28px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px', color: '#e2e8f0' }}>Overview</h3>
                <p style={{ fontSize: '15px', lineHeight: '1.7', color: '#94a3b8', maxWidth: '850px' }}>
                  {details.plot || 'No synopsis provided for this title.'}
                </p>
              </div>

              {/* Cast Row */}
              {details.cast.length > 0 && (
                <div style={{ marginBottom: '28px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px', color: '#e2e8f0' }}>Cast</h3>
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
              {details.episodes.length > 1 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#e2e8f0' }}>Episodes</h3>
                    {seasons.length > 1 && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {seasons.map((s) => (
                          <button
                            key={s}
                            onClick={() => setSelectedSeason(s)}
                            style={{
                              padding: '5px 12px',
                              borderRadius: '8px',
                              border: '1px solid',
                              borderColor: selectedSeason === s ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                              background: selectedSeason === s ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                              color: selectedSeason === s ? '#fff' : '#94a3b8',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Season {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {currentEpisodes.map((ep) => (
                      <div
                        key={ep.episode}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          background: 'rgba(255, 255, 255, 0.03)',
                          borderRadius: '10px',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                        }}
                        onClick={() => handlePlayEpisode(ep)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: 'rgba(99, 102, 241, 0.2)',
                              color: 'var(--primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '13px',
                            }}
                          >
                            {ep.episode}
                          </div>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>
                              {ep.name || `Episode ${ep.episode}`}
                            </div>
                            {ep.description && (
                              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', maxWidth: '600px' }}>
                                {ep.description}
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: extracting === ep.episode ? 'var(--accent-cyan)' : 'var(--text-muted)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '13px',
                            fontWeight: 600,
                          }}
                        >
                          <Play size={16} fill={extracting === ep.episode ? 'var(--accent-cyan)' : 'none'} />
                          {extracting === ep.episode ? 'Extracting...' : 'Play'}
                        </button>
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
