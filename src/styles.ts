import { HoregTheme, ThemeVariant } from './types';

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return `${r}, ${g}, ${b}`;
  }
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return `${r}, ${g}, ${b}`;
  }
  return '245, 158, 11';
}

function isLightColor(color?: string): boolean {
  if (!color) return false;
  const clean = color.replace('#', '');
  let r = 0, g = 0, b = 0;
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16);
    g = parseInt(clean[1] + clean[1], 16);
    b = parseInt(clean[2] + clean[2], 16);
  } else if (clean.length === 6) {
    r = parseInt(clean.substring(0, 2), 16);
    g = parseInt(clean.substring(2, 4), 16);
    b = parseInt(clean.substring(4, 6), 16);
  } else {
    return false;
  }
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
}

export const THEME_PRESETS: Record<ThemeVariant, Partial<HoregTheme>> = {
  'horeg-classic': {
    variant: 'horeg-classic',
    primaryGlowColor: '#f59e0b',
    accentColor: '#ef4444',
    cardBackground: '#121214',
    textColor: '#f4f4f5',
    sliderProgressColor: '#f59e0b',
    borderRadius: '14px',
    isLight: false
  },
  'horeg-nightclub': {
    variant: 'horeg-nightclub',
    primaryGlowColor: '#06b6d4',
    accentColor: '#ec4899',
    cardBackground: '#0b0c10',
    textColor: '#f8fafc',
    sliderProgressColor: '#06b6d4',
    borderRadius: '14px',
    isLight: false
  },
  'horeg-stealth': {
    variant: 'horeg-stealth',
    primaryGlowColor: '#94a3b8',
    accentColor: '#e2e8f0',
    cardBackground: '#0f1115',
    textColor: '#e2e8f0',
    sliderProgressColor: '#94a3b8',
    borderRadius: '8px',
    isLight: false
  },
  'horeg-light': {
    variant: 'horeg-light',
    primaryGlowColor: '#d97706',
    accentColor: '#dc2626',
    cardBackground: '#ffffff',
    textColor: '#0f172a',
    sliderProgressColor: '#d97706',
    borderRadius: '14px',
    surfaceColor: '#f8fafc',
    surfaceHoverColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    mutedTextColor: '#64748b',
    isLight: true
  },
  'horeg-light-clean': {
    variant: 'horeg-light-clean',
    primaryGlowColor: '#0284c7',
    accentColor: '#db2777',
    cardBackground: '#ffffff',
    textColor: '#0f172a',
    sliderProgressColor: '#0284c7',
    borderRadius: '14px',
    surfaceColor: '#f8fafc',
    surfaceHoverColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    mutedTextColor: '#64748b',
    isLight: true
  },
  'horeg-light-minimal': {
    variant: 'horeg-light-minimal',
    primaryGlowColor: '#475569',
    accentColor: '#2563eb',
    cardBackground: '#f8fafc',
    textColor: '#1e293b',
    sliderProgressColor: '#2563eb',
    borderRadius: '8px',
    surfaceColor: '#f1f5f9',
    surfaceHoverColor: '#e2e8f0',
    borderColor: '#e2e8f0',
    mutedTextColor: '#64748b',
    isLight: true
  }
};

/**
 * Returns complete encapsulated CSS string for the Shadow DOM.
 */
export function generateStyles(theme: HoregTheme = {}, maxWidth?: number | string): string {
  const variant = theme.variant || 'horeg-classic';
  const preset = THEME_PRESETS[variant] || THEME_PRESETS['horeg-classic'];

  let maxWidthCss = 'none';
  if (typeof maxWidth === 'number') {
    maxWidthCss = `${maxWidth}px`;
  } else if (typeof maxWidth === 'string' && maxWidth.trim() !== '' && maxWidth.trim().toLowerCase() !== 'fluid') {
    maxWidthCss = maxWidth.trim();
  }

  const isLight =
    theme.isLight ??
    (preset.isLight ?? (variant.includes('light') || isLightColor(theme.cardBackground || preset.cardBackground)));

  const glow = theme.primaryGlowColor || preset.primaryGlowColor || (isLight ? '#d97706' : '#f59e0b');
  const accent = theme.accentColor || preset.accentColor || (isLight ? '#dc2626' : '#ef4444');
  const bg = theme.cardBackground || preset.cardBackground || (isLight ? '#ffffff' : '#121214');
  const text = theme.textColor || preset.textColor || (isLight ? '#0f172a' : '#f4f4f5');
  const progress = theme.sliderProgressColor || preset.sliderProgressColor || glow;
  const radius = theme.borderRadius || preset.borderRadius || '14px';

  const surface = theme.surfaceColor || preset.surfaceColor || (isLight ? '#f8fafc' : '#18181b');
  const surfaceHover = theme.surfaceHoverColor || preset.surfaceHoverColor || (isLight ? '#f1f5f9' : '#222226');
  const border = theme.borderColor || preset.borderColor || (isLight ? '#e2e8f0' : '#27272a');
  const textMuted = theme.mutedTextColor || preset.mutedTextColor || (isLight ? '#64748b' : '#a1a1aa');

  // Specific element colors adapted for light vs dark mode
  const drawerBg = isLight ? surface : '#141416';
  const sliderBg = isLight ? '#e2e8f0' : '#27272a';
  const bufferBg = isLight ? '#cbd5e1' : '#3f3f46';
  const btnPlayBg = isLight ? '#ffffff' : '#1f1f23';
  const btnPlayText = isLight ? '#ffffff' : '#09090b';
  const boltBg = isLight ? '#94a3b8' : '#3f3f46';
  const boltBorder = isLight ? '#cbd5e1' : '#18181b';
  const grillColor = isLight ? '#cbd5e1' : '#2c2d33';
  const grillOpacity = isLight ? '0.35' : '0.3';
  const dropzoneBg = isLight ? '#f8fafc' : '#141416';
  const inputBg = isLight ? '#ffffff' : '#121214';
  const tabBtnBg = isLight ? '#f1f5f9' : '#202024';
  const tabBtnActiveBg = isLight ? '#ffffff' : '#27272a';
  const itemActiveBg = isLight
    ? `linear-gradient(90deg, rgba(${hexToRgb(glow)}, 0.12) 0%, rgba(${hexToRgb(glow)}, 0.02) 100%)`
    : 'linear-gradient(90deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)';
  const btnActiveBg = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.06)';
  const boxShadow = isLight
    ? '0 14px 36px -8px rgba(15, 23, 42, 0.12), 0 2px 10px -2px rgba(15, 23, 42, 0.06), 0 0 16px -4px var(--horeg-glow)'
    : '0 16px 40px -10px rgba(0, 0, 0, 0.9), 0 0 20px -5px var(--horeg-glow)';
  const focusBoxShadow = isLight
    ? '0 18px 44px -8px rgba(15, 23, 42, 0.18), 0 0 24px -2px var(--horeg-glow)'
    : '0 20px 48px -10px rgba(0, 0, 0, 0.95), 0 0 30px -2px var(--horeg-glow), 0 0 10px var(--horeg-glow)';

  return `
    :host {
      display: block;
      width: 100%;
      --horeg-max-width: ${maxWidthCss};
      --horeg-bg: ${bg};
      --horeg-surface: ${surface};
      --horeg-surface-hover: ${surfaceHover};
      --horeg-border: ${border};
      --horeg-glow: ${glow};
      --horeg-glow-rgb: ${hexToRgb(glow)};
      --horeg-accent: ${accent};
      --horeg-progress: ${progress};
      --horeg-text-main: ${text};
      --horeg-text-muted: ${textMuted};
      --horeg-radius: ${radius};
      --horeg-drawer-bg: ${drawerBg};
      --horeg-slider-bg: ${sliderBg};
      --horeg-slider-buffer: ${bufferBg};
      --horeg-btn-play-bg: ${btnPlayBg};
      --horeg-btn-play-text: ${btnPlayText};
      --horeg-bolt-bg: ${boltBg};
      --horeg-bolt-border: ${boltBorder};
      --horeg-grill-color: ${grillColor};
      --horeg-grill-opacity: ${grillOpacity};
      --horeg-dropzone-bg: ${dropzoneBg};
      --horeg-input-bg: ${inputBg};
      --horeg-tab-bg: ${tabBtnBg};
      --horeg-tab-active-bg: ${tabBtnActiveBg};
      --horeg-item-active-bg: ${itemActiveBg};
      --horeg-btn-active-bg: ${btnActiveBg};
      --horeg-box-shadow: ${boxShadow};
      --horeg-focus-shadow: ${focusBoxShadow};
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      box-sizing: border-box;
      outline: none;
      user-select: none;
      -webkit-user-select: none;
    }

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    .horeg-player-box {
      container-type: inline-size;
      container-name: horeg-box;
      background: var(--horeg-bg);
      border: 2px solid var(--horeg-border);
      border-radius: var(--horeg-radius);
      box-shadow: var(--horeg-box-shadow);
      color: var(--horeg-text-main);
      position: relative;
      overflow: hidden;
      width: 100%;
      max-width: var(--horeg-max-width, none);
      margin: 0 auto;
      transition: box-shadow 0.3s ease, border-color 0.3s ease;
    }

    /* Player Box active glow when focused within */
    :host(:focus) .horeg-player-box,
    :host(:focus-within) .horeg-player-box,
    .horeg-player-box:focus-within {
      border-color: var(--horeg-glow);
      box-shadow: var(--horeg-focus-shadow);
    }

    :host(:focus) .horeg-player-box .horeg-bolt,
    :host(:focus-within) .horeg-player-box .horeg-bolt,
    .horeg-player-box:focus-within .horeg-bolt {
      box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.3), 0 0 4px var(--horeg-glow);
    }

    .horeg-speaker-grill {
      position: absolute;
      inset: 0;
      background-image: radial-gradient(var(--horeg-grill-color) 1.2px, transparent 1.2px);
      background-size: 8px 8px;
      opacity: var(--horeg-grill-opacity);
      pointer-events: none;
      z-index: 1;
    }

    /* Metal Corner Brackets / Screws (Sound System Rig Rigging) */
    .horeg-bolt {
      position: absolute;
      width: 8px;
      height: 8px;
      background: var(--horeg-bolt-bg);
      border: 1px solid var(--horeg-bolt-border);
      border-radius: 50%;
      box-shadow: inset 0 1px 1px rgba(255,255,255,0.3), 0 1px 2px rgba(0,0,0,0.3);
      z-index: 2;
    }
    .horeg-bolt::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 4px;
      height: 1px;
      background: var(--horeg-bolt-border);
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
      border-bottom: 1px solid var(--horeg-border);
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
    /* 3-Soundbox Stage Visualizer */
    .horeg-soundbox-stage {
      position: relative;
      width: 100%;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 14px 24px;
      background: ${isLight ? 'rgba(0, 0, 0, 0.04)' : 'rgba(0, 0, 0, 0.45)'};
      border: 1px solid var(--horeg-border);
      border-radius: 12px;
      box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.35);
      overflow: visible;
    }

    /* Base Soundbox Cabinet */
    .horeg-soundbox {
      position: relative;
      background: var(--horeg-surface);
      border: 1px solid var(--horeg-border);
      box-sizing: border-box;
      flex-shrink: 0;
      user-select: none;
    }

    /* Miniature Box Bolts */
    .horeg-box-bolt {
      position: absolute;
      width: 5px;
      height: 5px;
      background: ${boltBg};
      border: 1px solid ${boltBorder};
      border-radius: 50%;
      z-index: 5;
    }

    .horeg-box-bolt.top-left { top: 4px; left: 4px; }
    .horeg-box-bolt.top-right { top: 4px; right: 4px; }
    .horeg-box-bolt.bottom-left { bottom: 4px; left: 4px; }
    .horeg-box-bolt.bottom-right { bottom: 4px; right: 4px; }

    /* Left & Right Satellite Speakers */
    .horeg-soundbox.is-satellite {
      width: 58px;
      height: 106px;
      border-radius: 6px;
      padding: 6px 4px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.06);
      z-index: 2;
      position: relative;
    }

    .horeg-soundbox.is-satellite.is-left {
      margin-right: -6px;
    }

    .horeg-soundbox.is-satellite.is-right {
      margin-left: -6px;
    }

    .horeg-box-header, .horeg-box-footer {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 10px;
    }

    .horeg-tweeter-slot {
      width: 14px;
      height: 3px;
      background: var(--horeg-glow);
      border-radius: 2px;
      opacity: 0.75;
      box-shadow: 0 0 4px var(--horeg-glow);
    }

    .horeg-port-slot {
      width: 16px;
      height: 3px;
      background: #090a0d;
      border: 1px solid var(--horeg-border);
      border-radius: 2px;
    }

    .horeg-satellite-baffle {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      flex: 1;
    }

    .horeg-satellite-driver {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Water-like Ripple Rings around the 4 Satellite Circles */
    .horeg-driver-ripple {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 38px;
      height: 38px;
      margin-top: -19px;
      margin-left: -19px;
      border-radius: 50%;
      border: 1.5px solid rgba(var(--horeg-glow-rgb), 0.5);
      box-shadow: 0 0 12px rgba(var(--horeg-glow-rgb), 0.25), inset 0 0 8px rgba(var(--horeg-glow-rgb), 0.125);
      opacity: 0;
      pointer-events: none;
      transform-origin: center center;
      transition: transform 0.06s ease-out, opacity 0.06s ease-out;
      z-index: 1;
    }

    .horeg-driver-ripple.ripple-2 {
      border-width: 1px;
    }

    .horeg-driver-surround {
      position: relative;
      z-index: 2;
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: #0c0d12;
      border: 1px solid var(--horeg-border);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.8);
    }

    .horeg-driver-cone {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: radial-gradient(circle, #2a2b33 0%, #15161c 65%, #09090b 100%);
      border: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      transform-origin: center center;
      will-change: transform;
      box-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
    }

    .horeg-driver-cap {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: radial-gradient(circle, var(--horeg-glow) 0%, #181920 80%);
      opacity: 0.85;
      box-shadow: 0 0 4px var(--horeg-glow);
    }

    /* Center Monster Subwoofer - Higher z-index in front of left and right */
    .horeg-soundbox.is-subwoofer {
      width: 126px;
      height: 126px;
      border-radius: 12px;
      border: 1.5px solid var(--horeg-border);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.08);
      z-index: 10 !important;
      position: relative;
      will-change: transform;
    }

    /* Concentric Bass Shockwaves */
    .horeg-shockwaves-wrap {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 0;
      height: 0;
      pointer-events: none;
      z-index: 6;
    }

    .horeg-shockwave {
      position: absolute;
      top: -50px;
      left: -50px;
      width: 100px;
      height: 100px;
      border-radius: 50%;
      border: 2px solid var(--horeg-glow);
      box-shadow: 0 0 16px var(--horeg-glow), inset 0 0 8px var(--horeg-glow);
      opacity: 0;
      transform-origin: center center;
      pointer-events: none;
      will-change: transform, opacity;
    }

    .horeg-shockwave.wave-1 {
      border-width: 2.5px;
    }

    .horeg-shockwave.wave-2 {
      border-width: 1.5px;
      border-style: dashed;
    }

    /* Subwoofer Frame Details */
    .horeg-sub-frame {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 3;
    }

    .horeg-sub-badge {
      position: absolute;
      top: 2px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 8px;
      font-weight: 800;
      letter-spacing: 1.2px;
      color: var(--horeg-glow);
      background: rgba(0, 0, 0, 0.2);
      padding: 1px 6px;
      border-radius: 3px;
      border: 1px solid rgba(255, 255, 255, 0.05);
      text-shadow: 0 0 6px var(--horeg-glow);
    }

    .horeg-sub-ports {
      position: absolute;
      bottom: 6px;
      left: 0;
      right: 0;
      display: flex;
      justify-content: space-between;
      padding: 0 12px;
    }

    .horeg-sub-port {
      width: 10px;
      height: 10px;
      background: #08080a;
      border-radius: 50%;
      border: 1px solid var(--horeg-border);
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.9);
    }

    /* Subwoofer Baffle, Surround & Cone */
    .horeg-sub-baffle {
      position: relative;
      z-index: 2;
      width: 96px;
      height: 96px;
      border-radius: 50%;
      background: #0a0b0e;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1.5px solid var(--horeg-border);
      box-shadow: inset 0 0 12px rgba(0, 0, 0, 0.9);
    }

    .horeg-sub-surround {
      width: 86px;
      height: 86px;
      border-radius: 50%;
      background: radial-gradient(circle, #1a1b22 60%, #0d0e13 100%);
      border: 2px solid rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      transform-origin: center center;
      will-change: transform;
      box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.7);
    }

    .horeg-sub-cone {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: radial-gradient(circle, #2a2b34 0%, #15161d 65%, #0a0a0d 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      transform-origin: center center;
      will-change: transform, box-shadow;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.6);
    }

    /* Circular Cover Art inside Subwoofer */
    .horeg-sub-cover-wrap {
      position: relative;
      width: 54px;
      height: 54px;
      min-width: 54px;
      border-radius: 50%;
      overflow: hidden;
      background: #0f1015;
      border: 2px solid var(--horeg-glow);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 12px var(--horeg-glow), inset 0 0 8px rgba(0, 0, 0, 0.6);
    }

    .horeg-cover-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .horeg-cover-fallback {
      color: var(--horeg-glow);
      opacity: 0.8;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Centered Metadata & Title Marquee Section */
    .horeg-track-meta {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      margin: 4px 0 2px 0;
      text-align: center;
      width: 100%;
    }

    .horeg-title-wrap {
      width: 100%;
      max-width: 380px;
      overflow: hidden;
      position: relative;
      margin: 0 auto;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .horeg-title-wrap.is-overflowing {
      justify-content: flex-start;
      -webkit-mask-image: linear-gradient(to right, #000 0%, #000 calc(100% - 24px), transparent 100%);
      mask-image: linear-gradient(to right, #000 0%, #000 calc(100% - 24px), transparent 100%);
      animation: horegTitleMask var(--marquee-duration, 8s) ease-in-out infinite;
    }

    /* Mask Fading:
       - 0% - 18%: Teks di ujung kiri (awal) -> fade kiri hilang (teks jelas), fade kanan aktif
       - 26% - 70%: Teks berjalan -> fade kiri & kanan sama-sama aktif
       - 78% - 86%: Teks di ujung kanan (akhir) -> fade kanan hilang (teks jelas), fade kiri aktif
       - 92% - 100%: Teks reset ke awal -> fade kiri hilang kembali, fade kanan aktif
    */
    @keyframes horegTitleMask {
      0%, 18% {
        -webkit-mask-image: linear-gradient(to right, #000 0%, #000 calc(100% - 24px), transparent 100%);
        mask-image: linear-gradient(to right, #000 0%, #000 calc(100% - 24px), transparent 100%);
      }
      26%, 70% {
        -webkit-mask-image: linear-gradient(to right, transparent 0%, #000 24px, #000 calc(100% - 24px), transparent 100%);
        mask-image: linear-gradient(to right, transparent 0%, #000 24px, #000 calc(100% - 24px), transparent 100%);
      }
      78%, 86% {
        -webkit-mask-image: linear-gradient(to right, transparent 0%, #000 24px, #000 100%);
        mask-image: linear-gradient(to right, transparent 0%, #000 24px, #000 100%);
      }
      92%, 100% {
        -webkit-mask-image: linear-gradient(to right, #000 0%, #000 calc(100% - 24px), transparent 100%);
        mask-image: linear-gradient(to right, #000 0%, #000 calc(100% - 24px), transparent 100%);
      }
    }

    .horeg-track-title {
      font-size: 15px;
      font-weight: 700;
      white-space: nowrap;
      display: inline-block;
      color: var(--horeg-text-main);
      letter-spacing: 0.2px;
      text-align: center;
      will-change: transform, opacity;
    }

    /* Marquee: Reset ke posisi awal (BUKAN rewind bolak-balik) */
    .horeg-track-title.is-marquee {
      animation: horegMarquee var(--marquee-duration, 8s) ease-in-out infinite;
    }

    @keyframes horegMarquee {
      0%, 18% {
        transform: translateX(0);
        opacity: 1;
      }
      76%, 86% {
        transform: translateX(var(--marquee-dist, -40px));
        opacity: 1;
      }
      90% {
        transform: translateX(var(--marquee-dist, -40px));
        opacity: 0;
      }
      93% {
        transform: translateX(0);
        opacity: 0;
      }
      100% {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .horeg-track-artist {
      font-size: 12px;
      font-weight: 500;
      color: var(--horeg-text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 360px;
      text-align: center;
    }

    .horeg-track-album {
      font-size: 10px;
      color: var(--horeg-text-muted);
      opacity: 0.8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 360px;
      text-align: center;
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
      background: var(--horeg-slider-bg);
      border-radius: 4px;
      cursor: pointer;
      overflow: hidden;
      box-shadow: inset 0 1px 3px rgba(0,0,0,0.2);
      touch-action: none;
    }

    .horeg-buffer-bar {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      width: 0%;
      background: var(--horeg-slider-buffer);
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
    }

    .horeg-slider-track.scrubbing .horeg-fill-bar,
    .horeg-slider-track:active .horeg-fill-bar,
    .horeg-player-box.scrubbing .horeg-fill-bar {
      transition: none !important;
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
      position: relative;
    }

    .horeg-btn:hover {
      color: var(--horeg-text-main);
      background: var(--horeg-surface-hover);
    }

    .horeg-btn:active {
      transform: scale(0.92);
      filter: brightness(1.2);
    }

    .horeg-btn:focus-visible {
      outline: 2px solid var(--horeg-glow);
      outline-offset: 1px;
    }

    .horeg-btn.active {
      color: var(--horeg-glow);
      background: var(--horeg-btn-active-bg);
      text-shadow: 0 0 8px var(--horeg-glow);
      box-shadow: inset 0 0 8px rgba(255, 255, 255, 0.05);
    }

    /* Tooltip Bubble */
    .horeg-btn[data-tooltip]::before {
      content: attr(data-tooltip);
      position: absolute;
      bottom: calc(100% + 7px);
      left: 50%;
      transform: translateX(-50%) translateY(4px);
      background: ${isLight ? 'rgba(15, 23, 42, 0.94)' : 'rgba(20, 20, 24, 0.96)'};
      color: ${isLight ? '#f8fafc' : 'var(--horeg-text-main)'};
      border: 1px solid var(--horeg-border);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.5), 0 0 8px rgba(var(--horeg-glow-rgb), 0.3);
      padding: 3px 8px;
      font-size: 11px;
      font-weight: 600;
      border-radius: 5px;
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s ease;
      z-index: 35;
      letter-spacing: 0.2px;
      font-family: inherit;
    }

    /* Tooltip Arrow */
    .horeg-btn[data-tooltip]::after {
      content: '';
      position: absolute;
      bottom: calc(100% + 2px);
      left: 50%;
      transform: translateX(-50%) translateY(4px);
      border-width: 5px 5px 0 5px;
      border-style: solid;
      border-color: ${isLight ? 'rgba(15, 23, 42, 0.94)' : 'rgba(20, 20, 24, 0.96)'} transparent transparent transparent;
      pointer-events: none;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s ease;
      z-index: 35;
    }

    .horeg-btn[data-tooltip]:hover::before,
    .horeg-btn[data-tooltip]:focus-visible::before,
    .horeg-btn[data-tooltip]:hover::after,
    .horeg-btn[data-tooltip]:focus-visible::after {
      opacity: 1;
      visibility: visible;
      transform: translateX(-50%) translateY(0);
    }

    /* Edge alignment so tooltips near container margins don't clip */
    .horeg-side-controls:first-child .horeg-btn:first-child[data-tooltip]::before {
      left: 0;
      transform: translateY(4px);
    }
    .horeg-side-controls:first-child .horeg-btn:first-child[data-tooltip]::after {
      left: 12px;
      transform: translateY(4px);
    }
    .horeg-side-controls:first-child .horeg-btn:first-child[data-tooltip]:hover::before,
    .horeg-side-controls:first-child .horeg-btn:first-child[data-tooltip]:focus-visible::before,
    .horeg-side-controls:first-child .horeg-btn:first-child[data-tooltip]:hover::after,
    .horeg-side-controls:first-child .horeg-btn:first-child[data-tooltip]:focus-visible::after {
      transform: translateY(0);
    }

    .horeg-side-controls:last-child .horeg-btn:last-child[data-tooltip]::before {
      left: auto;
      right: 0;
      transform: translateY(4px);
    }
    .horeg-side-controls:last-child .horeg-btn:last-child[data-tooltip]::after {
      left: auto;
      right: 12px;
      transform: translateY(4px);
    }
    .horeg-side-controls:last-child .horeg-btn:last-child[data-tooltip]:hover::before,
    .horeg-side-controls:last-child .horeg-btn:last-child[data-tooltip]:focus-visible::before,
    .horeg-side-controls:last-child .horeg-btn:last-child[data-tooltip]:hover::after,
    .horeg-side-controls:last-child .horeg-btn:last-child[data-tooltip]:focus-visible::after {
      transform: translateY(0);
    }

    /* Suppress volume button tooltip when dropup is active */
    .horeg-volume-wrap:hover .horeg-btn[data-tooltip]::before,
    .horeg-volume-wrap:hover .horeg-btn[data-tooltip]::after,
    .horeg-volume-wrap:focus-within .horeg-btn[data-tooltip]::before,
    .horeg-volume-wrap:focus-within .horeg-btn[data-tooltip]::after,
    .horeg-volume-wrap.open .horeg-btn[data-tooltip]::before,
    .horeg-volume-wrap.open .horeg-btn[data-tooltip]::after {
      display: none;
    }

    /* Primary Play / Pause Button with Neon Glow Pulse */
    .horeg-btn-play {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--horeg-btn-play-bg);
      border: 2px solid var(--horeg-glow);
      color: var(--horeg-glow);
      box-shadow: 0 0 12px -2px var(--horeg-glow);
      transition: transform 0.12s ease, box-shadow 0.2s ease, background 0.2s ease;
    }

    .horeg-btn-play:hover {
      background: var(--horeg-surface-hover);
      transform: scale(1.06);
      box-shadow: 0 0 18px 2px var(--horeg-glow);
    }

    .horeg-btn-play:active {
      transform: scale(0.96);
    }

    .horeg-btn-play.playing {
      background: var(--horeg-glow);
      color: var(--horeg-btn-play-text);
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

    /* Vertical Volume Dropup Mixer */
    .horeg-volume-wrap {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .horeg-volume-dropup {
      position: absolute;
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%) translateY(8px);
      background: ${isLight ? '#ffffff' : 'var(--horeg-surface)'};
      border: 1px solid var(--horeg-border);
      border-radius: 10px;
      padding: 8px 6px 8px 6px;
      box-shadow: 0 10px 24px -4px rgba(0, 0, 0, 0.6), 0 0 10px -2px var(--horeg-glow);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      width: 36px;
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transition: opacity 0.18s cubic-bezier(0.4, 0, 0.2, 1), transform 0.18s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.18s ease;
      z-index: 40;
    }

    /* Dropup hover bridge */
    .horeg-volume-dropup::before {
      content: '';
      position: absolute;
      top: 100%;
      left: -8px;
      right: -8px;
      height: 12px;
      background: transparent;
    }

    /* Dropup arrow pointer */
    .horeg-volume-dropup::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border-width: 5px 5px 0 5px;
      border-style: solid;
      border-color: ${isLight ? '#ffffff' : 'var(--horeg-surface)'} transparent transparent transparent;
    }

    .horeg-volume-wrap:hover .horeg-volume-dropup,
    .horeg-volume-wrap:focus-within .horeg-volume-dropup,
    .horeg-volume-wrap.open .horeg-volume-dropup {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
      transform: translateX(-50%) translateY(0);
    }

    .horeg-volume-percent {
      font-size: 10px;
      font-weight: 700;
      color: var(--horeg-glow);
      font-family: ui-monospace, monospace;
      letter-spacing: 0.5px;
      user-select: none;
      text-align: center;
      line-height: 1;
    }

    .horeg-volume-slider-vertical {
      -webkit-appearance: slider-vertical;
      appearance: slider-vertical;
      writing-mode: vertical-lr;
      direction: rtl;
      width: 8px;
      height: 84px;
      background: var(--horeg-slider-bg);
      border-radius: 4px;
      outline: none;
      cursor: pointer;
      margin: 0 auto;
    }

    .horeg-volume-slider-vertical::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--horeg-glow);
      border: 2px solid ${isLight ? '#ffffff' : '#18181b'};
      box-shadow: 0 0 6px var(--horeg-glow);
      cursor: pointer;
      transition: transform 0.1s ease;
    }

    .horeg-volume-slider-vertical::-webkit-slider-thumb:hover {
      transform: scale(1.2);
    }

    .horeg-volume-slider-vertical::-moz-range-thumb {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--horeg-glow);
      border: 2px solid ${isLight ? '#ffffff' : '#18181b'};
      box-shadow: 0 0 6px var(--horeg-glow);
      cursor: pointer;
    }

    /* Vertical Bass Booster Dropup Mixer */
    .horeg-bass-wrap {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Suppress bass button tooltip when dropup is active */
    .horeg-bass-wrap:hover .horeg-btn[data-tooltip]::before,
    .horeg-bass-wrap:hover .horeg-btn[data-tooltip]::after,
    .horeg-bass-wrap:focus-within .horeg-btn[data-tooltip]::before,
    .horeg-bass-wrap:focus-within .horeg-btn[data-tooltip]::after,
    .horeg-bass-wrap.open .horeg-btn[data-tooltip]::before,
    .horeg-bass-wrap.open .horeg-btn[data-tooltip]::after {
      display: none;
    }

    .horeg-bass-dropup {
      position: absolute;
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%) translateY(8px);
      background: ${isLight ? '#ffffff' : 'var(--horeg-surface)'};
      border: 1px solid var(--horeg-border);
      border-radius: 10px;
      padding: 8px 8px 7px 8px;
      box-shadow: 0 10px 24px -4px rgba(0, 0, 0, 0.6), 0 0 10px -2px var(--horeg-glow);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 7px;
      width: 48px;
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transition: opacity 0.18s cubic-bezier(0.4, 0, 0.2, 1), transform 0.18s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.18s ease;
      z-index: 40;
    }

    /* Dropup hover bridge */
    .horeg-bass-dropup::before {
      content: '';
      position: absolute;
      top: 100%;
      left: -8px;
      right: -8px;
      height: 12px;
      background: transparent;
    }

    /* Dropup arrow pointer */
    .horeg-bass-dropup::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border-width: 5px 5px 0 5px;
      border-style: solid;
      border-color: ${isLight ? '#ffffff' : 'var(--horeg-surface)'} transparent transparent transparent;
    }

    .horeg-bass-wrap:hover .horeg-bass-dropup,
    .horeg-bass-wrap:focus-within .horeg-bass-dropup,
    .horeg-bass-wrap.open .horeg-bass-dropup {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
      transform: translateX(-50%) translateY(0);
    }

    .horeg-bass-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1px;
      width: 100%;
    }

    .horeg-bass-label {
      font-size: 8px;
      font-weight: 800;
      color: var(--horeg-text-muted);
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }

    .horeg-bass-db {
      font-size: 9px;
      font-weight: 700;
      color: var(--horeg-text-main);
      font-family: ui-monospace, monospace;
      letter-spacing: 0.2px;
      user-select: none;
      text-align: center;
      line-height: 1.1;
      transition: color 0.15s ease, text-shadow 0.15s ease;
    }

    .horeg-bass-db.is-boosted {
      color: var(--horeg-glow);
      text-shadow: 0 0 6px rgba(var(--horeg-glow-rgb), 0.5);
    }

    .horeg-bass-db.is-cut {
      color: var(--horeg-text-muted);
      opacity: 0.8;
    }

    .horeg-bass-db.is-horeg {
      color: var(--horeg-accent);
      text-shadow: 0 0 8px var(--horeg-accent);
      font-weight: 800;
    }

    .horeg-bass-slider-vertical {
      -webkit-appearance: slider-vertical;
      appearance: slider-vertical;
      writing-mode: vertical-lr;
      direction: rtl;
      width: 8px;
      height: 84px;
      background: var(--horeg-slider-bg);
      border-radius: 4px;
      outline: none;
      cursor: pointer;
      margin: 0 auto;
    }

    .horeg-bass-slider-vertical::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--horeg-glow);
      border: 2px solid ${isLight ? '#ffffff' : '#18181b'};
      box-shadow: 0 0 6px var(--horeg-glow);
      cursor: pointer;
      transition: transform 0.1s ease;
    }

    .horeg-bass-slider-vertical::-webkit-slider-thumb:hover {
      transform: scale(1.2);
    }

    .horeg-bass-slider-vertical::-moz-range-thumb {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--horeg-glow);
      border: 2px solid ${isLight ? '#ffffff' : '#18181b'};
      box-shadow: 0 0 6px var(--horeg-glow);
      cursor: pointer;
    }

    /* Mega Bass / Horeg Boost Toggle Button */
    .horeg-btn-mega-bass {
      background: ${isLight ? '#f1f5f9' : '#181920'};
      border: 1px solid var(--horeg-border);
      border-radius: 4px;
      padding: 2px 4px;
      font-size: 8px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: var(--horeg-text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 3px;
      width: 100%;
      transition: all 0.15s ease;
      outline: none;
    }

    .horeg-btn-mega-bass:hover {
      color: var(--horeg-text-main);
      border-color: var(--horeg-glow);
    }

    .horeg-btn-mega-bass .horeg-mega-led {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: #52525b;
      transition: all 0.2s ease;
    }

    .horeg-btn-mega-bass.active {
      background: ${isLight ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.18)'};
      border-color: var(--horeg-accent);
      color: var(--horeg-accent);
      box-shadow: 0 0 8px rgba(239, 68, 68, 0.3);
    }

    .horeg-btn-mega-bass.active .horeg-mega-led {
      background: var(--horeg-accent);
      box-shadow: 0 0 6px var(--horeg-accent);
      animation: ledPulse 1.5s infinite ease-in-out;
    }

    @keyframes ledPulse {
      0%, 100% {
        opacity: 1;
        transform: scale(1);
      }
      50% {
        opacity: 0.5;
        transform: scale(1.3);
      }
    }

    /* Drag Over Highlight on main player */
    .horeg-player-box.drag-over {
      border-color: var(--horeg-glow);
      box-shadow: 0 0 25px var(--horeg-glow), 0 8px 32px rgba(0, 0, 0, 0.9);
    }

    /* Rack Mount Playlist Drawer */
    .horeg-drawer {
      max-height: 0;
      opacity: 0;
      overflow-y: auto;
      transition: max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease;
      background: var(--horeg-drawer-bg);
      border-top: 1px solid var(--horeg-border);
      border-radius: 0 0 calc(var(--horeg-radius) - 2px) calc(var(--horeg-radius) - 2px);
      scrollbar-width: thin;
      scrollbar-color: var(--horeg-border) var(--horeg-drawer-bg);
      position: relative;
      z-index: 3;
    }

    .horeg-drawer.open {
      max-height: 380px;
      opacity: 1;
    }

    /* Drawer Header */
    .horeg-drawer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px 8px 14px;
      border-bottom: 1px solid var(--horeg-border);
      position: sticky;
      top: 0;
      background: var(--horeg-drawer-bg);
      z-index: 2;
    }

    .horeg-drawer-heading {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.8px;
      color: var(--horeg-text-muted);
      text-transform: uppercase;
      font-family: ui-monospace, monospace;
    }

    .horeg-drawer-count {
      padding: 1px 6px;
      background: var(--horeg-surface-hover);
      color: var(--horeg-glow);
      border-radius: 10px;
      font-size: 10px;
      font-weight: 700;
    }

    .horeg-btn-add-track {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 9px;
      font-size: 11px;
      font-weight: 600;
      color: var(--horeg-text-main);
      background: var(--horeg-surface);
      border: 1px solid var(--horeg-border);
      border-radius: 5px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .horeg-btn-add-track:hover {
      background: var(--horeg-surface-hover);
      border-color: var(--horeg-glow);
      color: var(--horeg-glow);
      box-shadow: 0 0 8px rgba(var(--horeg-glow-rgb), 0.25);
    }

    .horeg-btn-add-track.active {
      background: var(--horeg-surface-hover);
      border-color: var(--horeg-glow);
      color: var(--horeg-glow);
      box-shadow: 0 0 12px var(--horeg-glow);
      text-shadow: 0 0 6px var(--horeg-glow);
    }

    .horeg-btn-add-track:active {
      transform: scale(0.95);
    }

    /* Add Track Panel Form */
    .horeg-add-panel {
      display: none;
      flex-direction: column;
      gap: 10px;
      margin: 10px 12px;
      padding: 12px;
      background: var(--horeg-surface);
      border: 1px solid var(--horeg-border);
      border-radius: 8px;
      box-shadow: inset 0 1px 4px rgba(0, 0, 0, 0.08);
      animation: fadeIn 0.2s ease;
    }

    .horeg-add-panel.open {
      display: flex;
    }

    .horeg-add-tabs {
      display: flex;
      gap: 6px;
      border-bottom: 1px solid var(--horeg-border);
      padding-bottom: 8px;
    }

    .horeg-tab-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 6px 10px;
      font-size: 11px;
      font-weight: 600;
      background: var(--horeg-tab-bg);
      color: var(--horeg-text-muted);
      border: 1px solid var(--horeg-border);
      border-radius: 5px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .horeg-tab-btn:hover {
      color: var(--horeg-text-main);
      background: var(--horeg-surface-hover);
      border-color: var(--horeg-border);
    }

    .horeg-tab-btn.active {
      background: var(--horeg-tab-active-bg);
      color: var(--horeg-glow);
      border-color: var(--horeg-glow);
      box-shadow: 0 0 10px var(--horeg-glow);
      text-shadow: 0 0 6px var(--horeg-glow);
    }

    .horeg-tab-btn:active {
      transform: scale(0.97);
    }

    .horeg-tab-pane {
      display: none;
      flex-direction: column;
      gap: 8px;
    }

    .horeg-tab-pane.active {
      display: flex;
    }

    /* Dropzone for local file */
    .horeg-dropzone {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 16px 10px;
      border: 2px dashed var(--horeg-border);
      border-radius: 6px;
      background: var(--horeg-dropzone-bg);
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: center;
    }

    .horeg-dropzone:hover,
    .horeg-dropzone.drag-active {
      border-color: var(--horeg-glow);
      background: rgba(var(--horeg-glow-rgb), 0.08);
      box-shadow: 0 0 10px rgba(var(--horeg-glow-rgb), 0.15);
    }

    .horeg-dropzone-icon {
      color: var(--horeg-glow);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .horeg-dropzone-text {
      font-size: 11px;
      font-weight: 600;
      color: var(--horeg-text-main);
    }

    .horeg-dropzone-hint {
      font-size: 10px;
      color: var(--horeg-text-muted);
    }

    /* Inputs for URL / Meta */
    .horeg-input-field {
      width: 100%;
      box-sizing: border-box;
      padding: 7px 10px;
      font-size: 12px;
      background: var(--horeg-input-bg);
      border: 1px solid var(--horeg-border);
      border-radius: 5px;
      color: var(--horeg-text-main);
      outline: none;
      transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
    }

    .horeg-input-field:focus {
      border-color: var(--horeg-glow);
      background: var(--horeg-surface);
      box-shadow: 0 0 0 1px var(--horeg-glow), 0 0 10px var(--horeg-glow);
      outline: none;
    }

    .horeg-input-field::placeholder {
      color: var(--horeg-text-muted);
      font-size: 11px;
    }

    .horeg-form-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
      margin-top: 4px;
    }

    .horeg-btn-submit {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 6px 12px;
      font-size: 11px;
      font-weight: 700;
      background: var(--horeg-glow);
      color: var(--horeg-btn-play-text);
      border: none;
      border-radius: 5px;
      cursor: pointer;
      transition: opacity 0.15s ease, transform 0.1s ease;
    }

    .horeg-btn-submit:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }

    .horeg-btn-submit:active {
      transform: scale(0.96);
      filter: brightness(1.15);
    }

    .horeg-btn-cancel {
      padding: 6px 10px;
      font-size: 11px;
      font-weight: 600;
      background: transparent;
      color: var(--horeg-text-muted);
      border: 1px solid transparent;
      border-radius: 5px;
      cursor: pointer;
      transition: color 0.15s ease, transform 0.1s ease;
    }

    .horeg-btn-cancel:hover {
      color: var(--horeg-text-main);
    }

    .horeg-btn-cancel:active {
      transform: scale(0.96);
    }

    .horeg-drawer-inner {
      padding: 6px 10px 10px 10px;
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
      background: var(--horeg-surface-hover);
    }

    .horeg-track-item.active {
      background: var(--horeg-item-active-bg);
      color: var(--horeg-glow);
      border-left: 3px solid var(--horeg-glow);
      box-shadow: inset 3px 0 6px -2px var(--horeg-glow), 0 2px 8px rgba(0, 0, 0, 0.15);
      position: relative;
    }

    .horeg-track-item.active .horeg-track-num {
      color: var(--horeg-glow);
      font-weight: 700;
      text-shadow: 0 0 8px var(--horeg-glow);
    }

    .horeg-track-item.active .horeg-item-title {
      color: var(--horeg-glow);
      font-weight: 700;
      text-shadow: 0 0 8px var(--horeg-glow);
    }

    .horeg-track-item.active .horeg-item-artist {
      color: var(--horeg-text-main);
      opacity: 0.9;
    }

    .horeg-track-item.active .horeg-item-duration {
      color: var(--horeg-glow);
      opacity: 0.9;
    }

    .horeg-track-item:focus-visible {
      outline: 2px solid var(--horeg-glow);
      outline-offset: -1px;
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
      margin-right: 4px;
    }

    /* Track Item Actions (Remove button) */
    .horeg-track-actions {
      display: flex;
      align-items: center;
      opacity: 0.5;
      transition: opacity 0.15s ease;
    }

    .horeg-track-item:hover .horeg-track-actions {
      opacity: 1;
    }

    .horeg-btn-remove {
      background: transparent;
      border: none;
      color: var(--horeg-text-muted);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
    }

    .horeg-btn-remove:hover {
      color: #ef4444;
      background: rgba(239, 68, 68, 0.15);
    }

    .horeg-empty-playlist {
      padding: 24px 12px;
      text-align: center;
      color: var(--horeg-text-muted);
      font-size: 12px;
      font-style: italic;
    }

    /* Responsive Layout (<= 360px): Single Center Soundbox & Wrapped Controls */
    @container horeg-box (max-width: 360px) {
      .horeg-content-wrap {
        padding: 14px 14px 12px 14px;
        gap: 10px;
      }

      /* 1. Visualizer: Hide Satellite Soundboxes, Center Subwoofer Dominates */
      .horeg-soundbox.is-satellite {
        display: none !important;
      }

      .horeg-soundbox-stage {
        padding: 10px 12px;
        gap: 0;
      }

      /* 2. Controls Row: Wrap into 2 Rows */
      .horeg-controls-row {
        flex-wrap: wrap;
        gap: 10px 0;
        justify-content: space-between;
      }

      /* Row 1: Center Controls (Prev, Play, Next) centered on top */
      .horeg-center-controls {
        order: 1;
        width: 100%;
        justify-content: center;
        gap: 16px;
        margin-bottom: 2px;
      }

      /* Row 2: Left Tools (Shuffle, Loop) & Right Tools (Volume, Playlist) with space-between */
      .horeg-side-controls:first-child {
        order: 2;
      }

      .horeg-side-controls:last-child {
        order: 3;
      }
    }

    /* Viewport Media Query fallback */
    @media (max-width: 360px) {
      .horeg-soundbox.is-satellite {
        display: none !important;
      }
      .horeg-soundbox-stage {
        padding: 10px 12px;
        gap: 0;
      }
      .horeg-controls-row {
        flex-wrap: wrap;
        gap: 10px 0;
        justify-content: space-between;
      }
      .horeg-center-controls {
        order: 1;
        width: 100%;
        justify-content: center;
        gap: 16px;
        margin-bottom: 2px;
      }
      .horeg-side-controls:first-child {
        order: 2;
      }
      .horeg-side-controls:last-child {
        order: 3;
      }
    }
  `;
}

