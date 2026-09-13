import React, { useEffect, useRef, useState } from 'react';

interface LazyMountProps {
  children: React.ReactNode;
  /** Approximate height reserved before mounting, to avoid scroll-position jumps. */
  minHeight?: number;
  /** How far outside the viewport to start mounting (gives a head start before scroll-into-view). */
  rootMargin?: string;
}

/**
 * Defers mounting expensive children (e.g. a shelf full of poster cards) until
 * they're about to enter the viewport. Once mounted, children stay mounted
 * (we don't unmount on scroll-out) so scroll position and internal state
 * aren't disturbed.
 *
 * This meaningfully reduces the number of DOM nodes / images the browser has
 * to lay out and style on initial home-page render when there are many
 * shelves, most of which are below the fold.
 */
export const LazyMount: React.FC<LazyMountProps> = ({ children, minHeight = 280, rootMargin = '800px 0px' }) => {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible, rootMargin]);

  return <div ref={ref} style={visible ? undefined : { minHeight }}>{visible ? children : null}</div>;
};
