import React from 'react';

interface ShortcutItem {
  action: string;
  keys: string[];
}

interface ShortcutCategory {
  title: string;
  items: ShortcutItem[];
}

export const ShortcutsTab: React.FC = () => {
  const categories: ShortcutCategory[] = [
    {
      title: 'Playback',
      items: [
        { action: 'Play / Pause', keys: ['Space', 'K'] },
        { action: 'Seek forward 10 seconds', keys: ['Right Arrow', 'L'] },
        { action: 'Seek backward 10 seconds', keys: ['Left Arrow', 'J'] },
        { action: 'Volume up', keys: ['Up Arrow'] },
        { action: 'Volume down', keys: ['Down Arrow'] },
        { action: 'Mute / Unmute audio', keys: ['M'] },
        { action: 'Next episode', keys: ['Shift + N'] },
        { action: 'Previous episode', keys: ['Shift + P'] },
        { action: 'Speed up playback', keys: [']'] },
        { action: 'Slow down playback', keys: ['['] },
        { action: 'Reset playback speed', keys: ['\\'] },
      ],
    },
    {
      title: 'Display & Screen',
      items: [
        { action: 'Toggle full screen', keys: ['F'] },
        { action: 'Exit full screen', keys: ['Esc'] },
        { action: 'Picture in Picture', keys: ['P'] },
      ],
    },
    {
      title: 'Subtitles & Audio',
      items: [
        { action: 'Toggle subtitles on / off', keys: ['C', 'S'] },
        { action: 'Cycle subtitle track', keys: ['V'] },
        { action: 'Cycle audio track', keys: ['B', 'A'] },
        { action: 'Subtitle delay (-100ms)', keys: ['Z'] },
        { action: 'Subtitle delay (+100ms)', keys: ['X'] },
      ],
    },
    {
      title: 'Navigation & App',
      items: [
        { action: 'Search catalog', keys: ['Ctrl + F', '/'] },
        { action: 'Quick exit / Quit', keys: ['Ctrl + Q'] },
      ],
    },
  ];

  return (
    <div className="stremio-settings-tab-pane animate-fade-in">
      {categories.map((cat) => (
        <div key={cat.title} style={{ marginBottom: '28px' }}>
          <h4
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#6e6a8d',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '10px',
            }}
          >
            {cat.title}
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {cat.items.map((item) => (
              <div key={item.action} className="stremio-setting-row">
                <span className="stremio-setting-label">{item.action}</span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {item.keys.map((k) => (
                    <kbd
                      key={k}
                      style={{
                        padding: '3px 8px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        fontWeight: 500,
                        color: '#9894b5',
                        fontFamily: 'inherit',
                      }}
                    >
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
