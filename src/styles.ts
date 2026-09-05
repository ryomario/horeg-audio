import { HoregTheme, ThemeVariant } from './types';

export const THEME_PRESETS: Record<ThemeVariant, Partial<HoregTheme>> = {
  'horeg-classic': {
    primaryGlowColor: '#f59e0b',
    accentColor: '#ef4444',
    cardBackground: '#121214',
    textColor: '#f4f4f5',
    sliderProgressColor: '#f59e0b',
    borderRadius: '14px'
  },
  'horeg-nightclub': {
    primaryGlowColor: '#06b6d4',
    accentColor: '#ec4899',
    cardBackground: '#0b0c10',
    textColor: '#f8fafc',
    sliderProgressColor: '#06b6d4',
    borderRadius: '14px'
  },
  'horeg-stealth': {
    primaryGlowColor: '#94a3b8',
    accentColor: '#e2e8f0',
    cardBackground: '#0f1115',
    textColor: '#e2e8f0',
    sliderProgressColor: '#94a3b8',
    borderRadius: '8px'
  }
};

/**
 * Returns complete encapsulated CSS string for the Shadow DOM.
 */
export function generateStyles(theme: HoregTheme = {}): string {
  const variant = theme.variant || 'horeg-classic';
  const preset = THEME_PRESETS[variant] || THEME_PRESETS['horeg-classic'];

  const glow = theme.primaryGlowColor || preset.primaryGlowColor || '#f59e0b';
  const accent = theme.accentColor || preset.accentColor || '#ef4444';
  const bg = theme.cardBackground || preset.cardBackground || '#121214';
  const text = theme.textColor || preset.textColor || '#f4f4f5';
  const progress = theme.sliderProgressColor || preset.sliderProgressColor || glow;
  const radius = theme.borderRadius || preset.borderRadius || '14px';

  return `
    :host {
      --horeg-bg: ${bg};
      --horeg-surface: #18181b;
      --horeg-surface-hover: #222226;
      --horeg-border: #27272a;
      --horeg-glow: ${glow};
      --horeg-glow-rgb: 245, 158, 11;
      --horeg-accent: ${accent};
      --horeg-progress: ${progress};
      --horeg-text-main: ${text};
      --horeg-text-muted: #a1a1aa;
      --horeg-radius: ${radius};
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      box-sizing: border-box;
      user-select: none;
      -webkit-user-select: none;
    }

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    .horeg-player-box {
      background: var(--horeg-bg);
      border: 2px solid var(--horeg-border);
      border-radius: var(--horeg-radius);
      box-shadow: 0 16px 40px -10px rgba(0, 0, 0, 0.9), 0 0 20px -5px var(--horeg-glow);
      color: var(--horeg-text-main);
      position: relative;
      overflow: hidden;
      max-width: 520px;
      width: 100%;
      margin: 0 auto;
      transition: box-shadow 0.3s ease, border-color 0.3s ease;
    }

    .horeg-speaker-grill {
      position: absolute;
      inset: 0;
      background-image: radial-gradient(#2c2d33 1.2px, transparent 1.2px);
      background-size: 8px 8px;
      opacity: 0.3;
      pointer-events: none;
      z-index: 1;
    }

    /* Metal Corner Brackets / Screws (Sound System Rig Rigging) */
    .horeg-bolt {
      position: absolute;
      width: 8px;
      height: 8px;
      background: #3f3f46;
      border: 1px solid #18181b;
      border-radius: 50%;
      box-shadow: inset 0 1px 1px rgba(255,255,255,0.2), 0 1px 2px rgba(0,0,0,0.8);
      z-index: 2;
    }
    .horeg-bolt::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 4px;
      height: 1px;
      background: #18181b;
      transform: translate(-50%, -50%) rotate(45deg);
    }
    .horeg-bolt.top-left { top: 7px; left: 7px; }
    .horeg-bolt.top-right { top: 7px; right: 7px; }
    .horeg-bolt.bottom-left { bottom: 7px; left: 7px; }
    .horeg-bolt.bottom-right { bottom: 7px; right: 7px; }

    .horeg-content-wrap {
      position: relative;
      z-index: 3;
      padding: 18px 20px 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    /* Top Rig Header */
    .horeg-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #27272a;
      padding-bottom: 8px;
    }

    .horeg-rig-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      font-weight: 800;
      color: var(--horeg-glow);
      text-shadow: 0 0 8px var(--horeg-glow);
    }

    .horeg-badge-led {
      width: 7px;
      height: 7px;
      background-color: var(--horeg-glow);
      border-radius: 50%;
      box-shadow: 0 0 6px var(--horeg-glow);
      animation: ledPulse 2s infinite ease-in-out;
    }

    @keyframes ledPulse {
      0%, 100% { opacity: 0.5; transform: scale(0.9); }
      50% { opacity: 1; transform: scale(1.1); box-shadow: 0 0 10px var(--horeg-glow); }
    }

    /* Track Display & Visualizer Section */
    .horeg-track-row {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .horeg-cover-container {
      position: relative;
      width: 64px;
      height: 64px;
      min-width: 64px;
      border-radius: 8px;
      overflow: hidden;
      background: #18181b;
      border: 1px solid #3f3f46;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: inset 0 0 10px rgba(0,0,0,0.8), 0 2px 6px rgba(0,0,0,0.6);
    }

    .horeg-cover-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .horeg-cover-fallback {
      color: var(--horeg-glow);
      opacity: 0.7;
    }

    .horeg-track-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .horeg-track-title {
      font-size: 15px;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--horeg-text-main);
      letter-spacing: 0.2px;
    }

    .horeg-track-artist {
      font-size: 12px;
      font-weight: 500;
      color: var(--horeg-text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .horeg-track-album {
      font-size: 10px;
      color: #71717a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Mini EQ Visualizer */
    .horeg-eq-wrapper {
      display: flex;
      align-items: flex-end;
      gap: 2px;
      height: 24px;
      padding: 0 4px;
    }

    .horeg-eq-bar {
      width: 3px;
      height: 4px;
      background: var(--horeg-glow);
      border-radius: 1px;
      transition: height 0.1s ease;
      box-shadow: 0 0 4px var(--horeg-glow);
    }

    /* Scrubbing / Fader Progress Bar */
    .horeg-progress-container {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .horeg-time-row {
      display: flex;
      justify-content: space-between;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 11px;
      color: var(--horeg-text-muted);
    }

    .horeg-slider-track {
      position: relative;
      width: 100%;
      height: 7px;
      background: #27272a;
      border-radius: 4px;
      cursor: pointer;
      overflow: hidden;
      box-shadow: inset 0 1px 3px rgba(0,0,0,0.8);
    }

    .horeg-buffer-bar {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      width: 0%;
      background: #3f3f46;
      border-radius: 4px;
      transition: width 0.2s linear;
    }

    .horeg-fill-bar {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      width: 0%;
      background: linear-gradient(90deg, var(--horeg-accent) 0%, var(--horeg-progress) 100%);
      border-radius: 4px;
      box-shadow: 0 0 8px var(--horeg-glow);
      transition: width 0.08s linear;
    }

    /* Controls Row */
    .horeg-controls-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 4px;
    }

    .horeg-side-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .horeg-center-controls {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .horeg-btn {
      background: transparent;
      border: none;
      outline: none;
      color: var(--horeg-text-muted);
      cursor: pointer;
      padding: 6px;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
      touch-action: manipulation;
    }

    .horeg-btn:hover {
      color: var(--horeg-text-main);
      background: var(--horeg-surface-hover);
    }

    .horeg-btn:focus-visible {
      outline: 2px solid var(--horeg-glow);
    }

    .horeg-btn.active {
      color: var(--horeg-glow);
      text-shadow: 0 0 8px var(--horeg-glow);
    }

    /* Primary Play / Pause Button with Neon Glow Pulse */
    .horeg-btn-play {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #1f1f23;
      border: 2px solid var(--horeg-glow);
      color: var(--horeg-glow);
      box-shadow: 0 0 12px -2px var(--horeg-glow);
      transition: transform 0.12s ease, box-shadow 0.2s ease, background 0.2s ease;
    }

    .horeg-btn-play:hover {
      background: #27272a;
      transform: scale(1.06);
      box-shadow: 0 0 18px 2px var(--horeg-glow);
    }

    .horeg-btn-play:active {
      transform: scale(0.96);
    }

    .horeg-btn-play.playing {
      background: var(--horeg-glow);
      color: #09090b;
      box-shadow: 0 0 20px var(--horeg-glow), inset 0 0 8px rgba(255, 255, 255, 0.4);
      animation: playPulse 2.2s infinite ease-in-out;
    }

    @keyframes playPulse {
      0%, 100% {
        box-shadow: 0 0 15px var(--horeg-glow);
      }
      50% {
        box-shadow: 0 0 25px var(--horeg-glow), 0 0 8px #fff;
      }
    }

    /* Volume Slider Rel Mixer */
    .horeg-volume-wrap {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .horeg-volume-slider {
      -webkit-appearance: none;
      appearance: none;
      width: 70px;
      height: 5px;
      background: #27272a;
      border-radius: 3px;
      outline: none;
      cursor: pointer;
    }

    .horeg-volume-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--horeg-glow);
      border: 1px solid #18181b;
      box-shadow: 0 0 6px var(--horeg-glow);
      cursor: pointer;
      transition: transform 0.1s ease;
    }

    .horeg-volume-slider::-webkit-slider-thumb:hover {
      transform: scale(1.2);
    }

    .horeg-volume-slider::-moz-range-thumb {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--horeg-glow);
      border: 1px solid #18181b;
      box-shadow: 0 0 6px var(--horeg-glow);
      cursor: pointer;
    }

    /* Rack Mount Playlist Drawer */
    .horeg-drawer {
      max-height: 0;
      opacity: 0;
      overflow-y: auto;
      transition: max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease;
      background: #141416;
      border-top: 1px solid #27272a;
      border-radius: 0 0 calc(var(--horeg-radius) - 2px) calc(var(--horeg-radius) - 2px);
      scrollbar-width: thin;
      scrollbar-color: #3f3f46 #18181b;
      position: relative;
      z-index: 3;
    }

    .horeg-drawer.open {
      max-height: 220px;
      opacity: 1;
    }

    .horeg-drawer-inner {
      padding: 8px 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .horeg-track-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.15s ease;
      font-size: 13px;
    }

    .horeg-track-item:hover {
      background: #1f1f23;
    }

    .horeg-track-item.active {
      background: #27272a;
      color: var(--horeg-glow);
      border-left: 3px solid var(--horeg-glow);
    }

    .horeg-track-num {
      font-family: ui-monospace, monospace;
      font-size: 11px;
      color: var(--horeg-text-muted);
      width: 18px;
    }

    .horeg-track-details {
      flex: 1;
      min-width: 0;
    }

    .horeg-item-title {
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .horeg-item-artist {
      font-size: 11px;
      color: var(--horeg-text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .horeg-item-duration {
      font-family: ui-monospace, monospace;
      font-size: 11px;
      color: var(--horeg-text-muted);
    }
  `;
}

