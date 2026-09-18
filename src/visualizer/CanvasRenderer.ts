import { ShockwaveRing, StrobeLightingState } from './types';
import { HoregTheme } from '../types';

export interface CanvasRenderParams {
  bass: number;
  left: number;
  right: number;
  coneScale: number;
  surroundScale: number;
  shockwaves: ShockwaveRing[];
  strobeState: StrobeLightingState;
  coverElement?: HTMLElement | null;
}

function parseColorToRgb(color: string): [number, number, number] {
  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    const num = parseInt(hex, 16);
    if (!isNaN(num)) {
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    }
  } else if (color.startsWith('rgb')) {
    const parts = color.match(/\d+/g);
    if (parts && parts.length >= 3) {
      return [parseInt(parts[0], 10), parseInt(parts[1], 10), parseInt(parts[2], 10)];
    }
  }
  return [245, 158, 11]; // default Horeg Amber fallback
}

function toRgba(color: string, alpha: number): string {
  const [r, g, b] = parseColorToRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private theme: HoregTheme;

  constructor(canvas?: HTMLCanvasElement, theme?: HoregTheme) {
    this.canvas = canvas || document.createElement('canvas');
    this.canvas.className = 'horeg-canvas-visualizer';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.minHeight = '156px';
    this.canvas.style.display = 'block';
    this.canvas.style.borderRadius = '12px';
    this.ctx = this.canvas.getContext('2d');
    this.theme = theme || {};
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public getContext(): CanvasRenderingContext2D | null {
    return this.ctx;
  }

  public setTheme(theme: HoregTheme): void {
    this.theme = { ...theme };
  }

  public getTheme(): HoregTheme {
    return { ...this.theme };
  }

  public render(params: CanvasRenderParams): void {
    if (!this.canvas || !this.ctx) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    let w = Math.floor(rect.width);
    let h = Math.floor(rect.height);

    // Fallbacks if element has not yet performed full synchronous layout
    if (w === 0 && this.canvas.parentElement) {
      const pRect = this.canvas.parentElement.getBoundingClientRect();
      w = Math.floor(pRect.width);
      h = Math.floor(pRect.height);
    }
    if (w === 0) w = this.canvas.clientWidth || 380;
    if (h === 0) h = this.canvas.clientHeight || 156;

    if (this.canvas.width !== w * dpr || this.canvas.height !== h * dpr) {
      this.canvas.width = w * dpr;
      this.canvas.height = h * dpr;
    }

    const ctx = this.ctx;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const centerX = w / 2;
    const centerY = h / 2;
    const { bass, left, right, coneScale, surroundScale, shockwaves, strobeState, coverElement } = params;

    const primaryGlow = this.theme.primaryGlowColor || '#f59e0b';
    const accentColor = this.theme.accentColor || '#ef4444';

    // 1. Stage Background & Strobe Ambient Lighting
    this.drawStageBackground(ctx, w, h, centerX, centerY, strobeState, bass, primaryGlow, accentColor);

    // 2. Left Satellite Sound Tower
    this.drawSatellite(ctx, centerX, centerY, w, h, 'left', left, strobeState, primaryGlow);

    // 3. Right Satellite Sound Tower
    this.drawSatellite(ctx, centerX, centerY, w, h, 'right', right, strobeState, primaryGlow);

    // 4. Center Monster Subwoofer
    this.drawSubwoofer(ctx, centerX, centerY, w, h, bass, coneScale, surroundScale, shockwaves, strobeState, primaryGlow, accentColor);

    // 5. Overhead Strobe Rig Truss & Flashes
    this.drawStrobeRig(ctx, w, h, strobeState, primaryGlow);

    ctx.restore();

    // Scale cover art smoothly if present in DOM container
    if (coverElement) {
      const coverScale = 1.0 + bass * 0.12;
      coverElement.style.transform = `scale(${coverScale.toFixed(3)})`;
    }
  }

  private drawStageBackground(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    centerX: number,
    centerY: number,
    strobe: StrobeLightingState,
    bass: number,
    glowColor: string,
    accentColor: string
  ): void {
    // Deep stage floor and vignette
    const bgGrad = ctx.createRadialGradient(centerX, centerY, h * 0.15, centerX, centerY, Math.max(w, h) * 0.75);
    bgGrad.addColorStop(0, '#18181c');
    bgGrad.addColorStop(0.6, '#0f0f12');
    bgGrad.addColorStop(1, '#08080a');

    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Blinder Flood flash: covers stage in warm golden/white glow
    if (strobe.blinderIntensity > 0.02) {
      ctx.fillStyle = `rgba(254, 243, 199, ${(strobe.blinderIntensity * 0.35).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Subwoofer Cabinet Underglow / Floor reflection (matches theme glow color!):
    if (strobe.underglowIntensity > 0.02 || bass > 0.2) {
      const glowPower = Math.max(strobe.underglowIntensity, bass * 0.7);
      const floorGrad = ctx.createRadialGradient(centerX, h * 0.88, 10, centerX, h * 0.88, w * 0.42);
      floorGrad.addColorStop(0, toRgba(glowColor, glowPower * 0.5));
      floorGrad.addColorStop(0.55, toRgba(accentColor, glowPower * 0.22));
      floorGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, h * 0.55, w, h * 0.45);
    }
  }

  private drawSatellite(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    w: number,
    h: number,
    side: 'left' | 'right',
    energy: number,
    strobe: StrobeLightingState,
    glowColor: string
  ): void {
    const satW = Math.min(84, w * 0.18);
    const satH = Math.min(148, h * 0.78);
    const x = side === 'left' ? Math.max(12, centerX - satW * 2.22) : Math.min(w - satW - 12, centerX + satW * 1.22);
    const driverRadius = satW * 0.32;
    const driverScale = 1.0 + energy * 0.18;
    const topY = centerY - satH * 0.23;
    const bottomY = centerY + satH * 0.23;
    const satCenterX = x + satW / 2;

    // Cabinet Box
    ctx.fillStyle = '#121214';
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, centerY - satH / 2, satW, satH, 6);
    } else {
      ctx.rect(x, centerY - satH / 2, satW, satH);
    }
    ctx.fill();
    ctx.stroke();

    // Tweeter slot & bass port accents
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(x + satW * 0.25, centerY - satH / 2 + 6, satW * 0.5, 4);
    ctx.fillRect(x + satW * 0.3, centerY + satH / 2 - 10, satW * 0.4, 4);

    // Drivers
    [topY, bottomY].forEach((driverY) => {
      // Acoustic water ripple rings (theme glow color)
      if (energy > 0.03) {
        ctx.beginPath();
        ctx.arc(satCenterX, driverY, driverRadius * (1.18 + energy * 0.42), 0, Math.PI * 2);
        ctx.strokeStyle = toRgba(glowColor, Math.min(0.85, energy * 0.8));
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Outer rubber ring
      ctx.beginPath();
      ctx.arc(satCenterX, driverY, driverRadius * driverScale, 0, Math.PI * 2);
      ctx.fillStyle = '#18181b';
      ctx.fill();
      ctx.strokeStyle = '#3f3f46';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Cone core
      ctx.beginPath();
      ctx.arc(satCenterX, driverY, driverRadius * 0.38 * driverScale, 0, Math.PI * 2);
      ctx.fillStyle = glowColor;
      ctx.fill();
    });

    // Side strobe highlight on satellite cabinets
    if (strobe.sideFlashIntensity > 0.05) {
      ctx.fillStyle = `rgba(255, 255, 255, ${(strobe.sideFlashIntensity * 0.3).toFixed(3)})`;
      ctx.fillRect(x, centerY - satH / 2, satW, satH);
    }
  }

  private drawSubwoofer(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    w: number,
    h: number,
    bass: number,
    coneScale: number,
    surroundScale: number,
    shockwaves: ShockwaveRing[],
    strobe: StrobeLightingState,
    glowColor: string,
    accentColor: string
  ): void {
    const subSize = Math.min(w * 0.42, h * 0.88);
    const subRadius = subSize / 2;

    // Shockwave expansion rings (matches theme glow & accent colors!)
    for (const wave of shockwaves) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, subRadius * wave.radius, 0, Math.PI * 2);
      const ringColor = wave.color.includes('239') ? toRgba(accentColor, wave.opacity) : toRgba(glowColor, wave.opacity);
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Micro-rumble vibration on sound horeg power hits
    let rumbleX = 0;
    let rumbleY = 0;
    if (bass > 0.45) {
      const r = (bass - 0.45) / 0.55;
      rumbleX = (Math.random() - 0.5) * 2.0 * r;
      rumbleY = (Math.random() - 0.5) * 2.0 * r;
    }

    const boxX = centerX - subSize / 2 + rumbleX;
    const boxY = centerY - subSize / 2 + rumbleY;

    // Subwoofer Cabinet (Textured speaker box)
    ctx.fillStyle = '#141416';
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(boxX, boxY, subSize, subSize, 12);
    } else {
      ctx.rect(boxX, boxY, subSize, subSize);
    }
    ctx.fill();
    ctx.stroke();

    // Rigging corner bolts & badge
    const boltSize = Math.max(4, subSize * 0.035);
    const boltMargin = 10;
    ctx.fillStyle = '#52525b';
    ctx.beginPath();
    ctx.arc(boxX + boltMargin, boxY + boltMargin, boltSize, 0, Math.PI * 2);
    ctx.arc(boxX + subSize - boltMargin, boxY + boltMargin, boltSize, 0, Math.PI * 2);
    ctx.arc(boxX + boltMargin, boxY + subSize - boltMargin, boltSize, 0, Math.PI * 2);
    ctx.arc(boxX + subSize - boltMargin, boxY + subSize - boltMargin, boltSize, 0, Math.PI * 2);
    ctx.fill();

    // Sub Ports at bottom with neon port glow
    const portW = subSize * 0.16;
    const portH = Math.max(5, subSize * 0.05);
    const portY = boxY + subSize - 18;
    const portGlow = Math.max(strobe.underglowIntensity, bass * 0.7);

    ctx.fillStyle = '#09090b';
    ctx.fillRect(boxX + 16, portY, portW, portH);
    ctx.fillRect(boxX + subSize - 16 - portW, portY, portW, portH);

    if (portGlow > 0.05) {
      ctx.fillStyle = toRgba(glowColor, portGlow * 0.85);
      ctx.fillRect(boxX + 17, portY + 1, portW - 2, portH - 2);
      ctx.fillRect(boxX + subSize - 15 - portW, portY + 1, portW - 2, portH - 2);
    }

    // Heavy Rubber Surround Ring
    ctx.beginPath();
    ctx.arc(centerX + rumbleX, centerY + rumbleY, subRadius * 0.82 * surroundScale, 0, Math.PI * 2);
    ctx.fillStyle = '#27272a';
    ctx.fill();
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Deep Subwoofer Cone Excursion
    const coneRadius = subRadius * 0.70 * coneScale;
    const radGrad = ctx.createRadialGradient(
      centerX + rumbleX,
      centerY + rumbleY,
      coneRadius * 0.1,
      centerX + rumbleX,
      centerY + rumbleY,
      coneRadius
    );
    radGrad.addColorStop(0, '#27272a');
    radGrad.addColorStop(0.75, '#121214');
    radGrad.addColorStop(1, '#09090b');

    ctx.beginPath();
    ctx.arc(centerX + rumbleX, centerY + rumbleY, coneRadius, 0, Math.PI * 2);
    ctx.fillStyle = radGrad;
    ctx.fill();

    // Excursion rim ring lighting (theme glow color)
    const rimAlpha = Math.min(0.9, 0.2 + bass * 0.75 + strobe.strobeIntensity * 0.4);
    ctx.strokeStyle = toRgba(glowColor, rimAlpha);
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Center dust cap
    ctx.beginPath();
    ctx.arc(centerX + rumbleX, centerY + rumbleY, coneRadius * 0.32, 0, Math.PI * 2);
    ctx.fillStyle = '#18181b';
    ctx.fill();
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }

  private drawStrobeRig(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    strobe: StrobeLightingState,
    glowColor: string
  ): void {
    if (strobe.strobeIntensity <= 0.02) return;

    // Overhead and stage bottom truss LED strobe bars
    const barH = 5;
    const numSegments = 12;
    const segW = (w - 32) / numSegments;
    const alpha = Math.min(1.0, strobe.strobeIntensity * 0.95);

    ctx.save();
    for (let i = 0; i < numSegments; i++) {
      const segX = 16 + i * segW + 2;
      const actualSegW = segW - 4;

      // Top truss LED pulse
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
      ctx.fillRect(segX, 8, actualSegW, barH);

      // Bottom truss LED pulse
      ctx.fillRect(segX, h - 13, actualSegW, barH);

      // Theme glow accent on strobe bar
      ctx.fillStyle = toRgba(glowColor, alpha * 0.5);
      ctx.fillRect(segX - 2, 6, actualSegW + 4, barH + 4);
      ctx.fillRect(segX - 2, h - 15, actualSegW + 4, barH + 4);
    }
    ctx.restore();
  }

  public destroy(): void {
    this.ctx = null;
  }
}
