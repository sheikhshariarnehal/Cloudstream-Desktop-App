import React from 'react';

interface HomeCatalogSkeletonProps {
  providerName?: string;
}

export const HomeCatalogSkeleton: React.FC<HomeCatalogSkeletonProps> = () => {
  return (
    <div className="home-skeleton-container" style={{ padding: '0 0 60px 0', animation: 'fadeIn 0.25s ease' }}>
      {/* Hero Banner Skeleton */}
      <div
        className="skeleton-hero"
        style={{
          height: '420px',
          borderRadius: '24px',
          margin: '12px 28px 40px 28px',
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(124, 58, 237, 0.08) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: '44px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Shimmer Overlay */}
        <div className="skeleton-shimmer" style={{ position: 'absolute', inset: 0 }} />

        {/* Hero Content Skeletons */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '640px' }}>
          {/* Spotlight Tag Placeholder */}
          <div
            style={{
              width: '140px',
              height: '18px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.08)',
            }}
          />

          {/* Title Placeholder */}
          <div
            style={{
              width: '75%',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.1)',
            }}
          />

          {/* Meta Tags Row */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ width: '56px', height: '20px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.07)' }} />
            <div style={{ width: '64px', height: '20px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.07)' }} />
            <div style={{ width: '50px', height: '20px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.07)' }} />
            <div style={{ width: '80px', height: '20px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.07)' }} />
          </div>

          {/* Description Lines */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
            <div style={{ width: '90%', height: '14px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.06)' }} />
            <div style={{ width: '65%', height: '14px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.06)' }} />
          </div>

          {/* Action Buttons Skeleton */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
            <div style={{ width: '128px', height: '42px', borderRadius: '12px', background: 'rgba(124, 58, 237, 0.4)' }} />
            <div style={{ width: '148px', height: '42px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.08)' }} />
          </div>
        </div>
      </div>

      {/* Shelf Skeletons (3 Rows) */}
      {[1, 2, 3].map((shelfIdx) => (
        <div key={shelfIdx} style={{ margin: '0 28px 36px 28px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Shelf Title Placeholder */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
              style={{
                width: shelfIdx === 1 ? '180px' : shelfIdx === 2 ? '220px' : '150px',
                height: '24px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.09)',
              }}
            />
            <div style={{ width: '60px', height: '18px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.04)' }} />
          </div>

          {/* Cards Row Placeholder */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: '16px',
              overflow: 'hidden',
            }}
          >
            {[1, 2, 3, 4, 5, 6, 7].map((cardIdx) => (
              <div
                key={cardIdx}
                style={{
                  aspectRatio: '2 / 3',
                  borderRadius: '16px',
                  position: 'relative',
                  overflow: 'hidden',
                  background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.02) 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                <div className="skeleton-shimmer" style={{ position: 'absolute', inset: 0 }} />
                <div
                  style={{
                    position: 'absolute',
                    bottom: '12px',
                    left: '12px',
                    right: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ width: '80%', height: '12px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.12)' }} />
                  <div style={{ width: '45%', height: '10px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.07)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
