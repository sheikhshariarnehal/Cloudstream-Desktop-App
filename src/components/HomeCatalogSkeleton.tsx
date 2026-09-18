import React from 'react';

interface HomeCatalogSkeletonProps {
  providerName?: string;
}

export const HomeCatalogSkeleton: React.FC<HomeCatalogSkeletonProps> = () => {
  return (
    <div className="home-skeleton-container" style={{ animation: 'fadeIn 0.2s ease', background: 'transparent' }}>
      {/* Hero Banner Skeleton — flat, neutral, no background box, no borders, no glow, no blur */}
      <div
        className="skeleton-hero"
        style={{
          width: '100%',
          height: '420px',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: '20px',
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
          outline: 'none',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: '48px 40px',
          boxSizing: 'border-box',
        }}
      >
        <div className="skeleton-shimmer" style={{ position: 'absolute', inset: 0 }} />

        {/* Hero Content Skeletons */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '640px' }}>
          {/* Spotlight Tag Placeholder */}
          <div
            style={{
              width: '130px',
              height: '18px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              boxShadow: 'none',
            }}
          />

          {/* Title Placeholder */}
          <div
            style={{
              width: '65%',
              height: '40px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.07)',
              border: 'none',
              boxShadow: 'none',
            }}
          />

          {/* Meta Tags Row */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ width: '56px', height: '20px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.05)', border: 'none', boxShadow: 'none' }} />
            <div style={{ width: '64px', height: '20px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.05)', border: 'none', boxShadow: 'none' }} />
            <div style={{ width: '50px', height: '20px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.05)', border: 'none', boxShadow: 'none' }} />
          </div>

          {/* Description Lines */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            <div style={{ width: '85%', height: '14px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.05)', border: 'none', boxShadow: 'none' }} />
            <div style={{ width: '60%', height: '14px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.04)', border: 'none', boxShadow: 'none' }} />
          </div>

          {/* Action Buttons Skeleton — neutral monochrome, no purple glow/color */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <div style={{ width: '120px', height: '38px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.08)', border: 'none', boxShadow: 'none' }} />
            <div style={{ width: '140px', height: '38px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.05)', border: 'none', boxShadow: 'none' }} />
          </div>
        </div>
      </div>

      {/* Media Shelves Skeletons — matching stremio-board-container layout */}
      <div className="stremio-board-container" style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}>
        {[1, 2, 3].map((shelfIdx) => (
          <div key={shelfIdx} className="media-shelf-container" style={{ border: 'none', boxShadow: 'none' }}>
            {/* Shelf Header */}
            <div className="media-shelf-header" style={{ border: 'none', boxShadow: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: shelfIdx === 1 ? '190px' : shelfIdx === 2 ? '230px' : '160px',
                    height: '24px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.07)',
                    border: 'none',
                    boxShadow: 'none',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.03)', border: 'none', boxShadow: 'none' }} />
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.03)', border: 'none', boxShadow: 'none' }} />
              </div>
            </div>

            {/* 8-Card Row matching actual desktop shelf layout — pure flat, no border rim, no glow */}
            <div className="media-shelf-row" style={{ border: 'none', boxShadow: 'none' }}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((cardIdx) => (
                <div key={cardIdx} className="media-shelf-item" style={{ border: 'none', boxShadow: 'none' }}>
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '2 / 3',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      position: 'relative',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: 'none',
                      boxShadow: 'none',
                      outline: 'none',
                    }}
                  >
                    <div className="skeleton-shimmer" style={{ position: 'absolute', inset: 0 }} />
                  </div>
                  {/* Title & subtitle placeholders matching centered card typography */}
                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: '75%', height: '11px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.06)', border: 'none', boxShadow: 'none' }} />
                    <div style={{ width: '45%', height: '9px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.03)', border: 'none', boxShadow: 'none' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
