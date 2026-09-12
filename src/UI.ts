import { Track, LoopMode } from './types';
import { formatTime, clamp } from './utils/time';
import { ICONS, createElement } from './utils/dom';

export interface UIEvents {
  onPlayPauseClick: () => void;
  onPrevClick: () => void;
  onNextClick: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (volume: number) => void;
  onBassChange?: (bassLevel: number) => void;
  onMuteToggle: () => void;
  onShuffleToggle: () => void;
  onLoopToggle: () => void;
  onTrackSelect: (index: number) => void;
  onAddTrackFiles?: (files: File[]) => void;
  onAddTrackUrl?: (url: string, title?: string, artist?: string) => void;
  onRemoveTrack?: (index: number) => void;
}

export interface UIOptions {
  enableBassControl?: boolean;
  initialBass?: number;
}

export class UI {
  public root: HTMLElement;
  public stageContainer: HTMLElement;
  public eqContainer: HTMLElement;
  public coverContainer: HTMLElement;
  public titleWrap: HTMLElement;

  private playBtn: HTMLButtonElement;
  private prevBtn: HTMLButtonElement;
  private nextBtn: HTMLButtonElement;
  private shuffleBtn: HTMLButtonElement;
  private loopBtn: HTMLButtonElement;
  private muteBtn: HTMLButtonElement;
  private drawerBtn: HTMLButtonElement;

  private titleEl: HTMLElement;
  private artistEl: HTMLElement;
  private albumEl: HTMLElement;
  private coverImgEl: HTMLImageElement | null = null;

  private currentTimeEl: HTMLElement;
  private durationEl: HTMLElement;
  private sliderTrack: HTMLElement;
  private fillBar: HTMLElement;
  private bufferBar: HTMLElement;

  private volumeSlider: HTMLInputElement;
  private volumeWrap: HTMLElement;
  private volumeDropup: HTMLElement;
  private volumePercentEl: HTMLElement;

  private bassWrap: HTMLElement | null = null;
  private bassBtn: HTMLButtonElement | null = null;
  private bassDropup: HTMLElement | null = null;
  private bassDbEl: HTMLElement | null = null;
  private bassSlider: HTMLInputElement | null = null;
  private megaBassBtn: HTMLButtonElement | null = null;
  private currentBass: number = 0;

  private drawerEl: HTMLElement;
  private drawerCountEl: HTMLElement;
  private addTrackBtn: HTMLButtonElement;
  private addPanelEl: HTMLElement;
  private fileInputEl: HTMLInputElement;
  private tabBtnFile: HTMLButtonElement;
  private tabBtnUrl: HTMLButtonElement;
  private tabPaneFile: HTMLElement;
  private tabPaneUrl: HTMLElement;
  private urlInput: HTMLInputElement;
  private titleInput: HTMLInputElement;
  private artistInput: HTMLInputElement;
  private submitUrlBtn: HTMLButtonElement;
  private cancelAddBtn: HTMLButtonElement;
  private dropzoneEl: HTMLElement;
  private drawerInner: HTMLElement;

  private isScrubbing: boolean = false;
  private currentDuration: number = 0;
  private events: UIEvents;

  constructor(events: UIEvents, uiOptions?: UIOptions) {
    this.events = events;
    const enableBass = uiOptions?.enableBassControl !== false;
    this.currentBass = uiOptions?.initialBass !== undefined ? clamp(uiOptions.initialBass, -10, 15) : 0;

    // Create main player container
    this.root = createElement('div', { className: 'horeg-player-box' });

    // Speaker grill overlay
    const grill = createElement('div', { className: 'horeg-speaker-grill' });
    this.root.appendChild(grill);

    // Rigging bolts
    ['top-left', 'top-right', 'bottom-left', 'bottom-right'].forEach((pos) => {
      this.root.appendChild(createElement('div', { className: `horeg-bolt ${pos}` }));
    });

    // Content wrapper
    const contentWrap = createElement('div', { className: 'horeg-content-wrap' });
    this.root.appendChild(contentWrap);

    // 1. Rig Header
    const header = createElement('div', { className: 'horeg-header' });
    const badge = createElement('div', {
      className: 'horeg-rig-badge',
      innerHTML: /* html */ `<span class="horeg-badge-led"></span> SOUND HOREG • HIGH VOLTAGE`
    });
    header.appendChild(badge);
    contentWrap.appendChild(header);

    // 2. Full-Width 3-Soundbox Stage & Centered Metadata
    this.stageContainer = createElement('div', { className: 'horeg-soundbox-stage' });
    this.eqContainer = this.stageContainer; // backwards compatibility

    this.coverContainer = createElement('div', { className: 'horeg-sub-cover-wrap' });
    this.coverContainer.innerHTML = /* html */ `<span class="horeg-cover-fallback">${ICONS.speaker}</span>`;

    const metaWrap = createElement('div', { className: 'horeg-track-meta' });
    this.titleWrap = createElement('div', { className: 'horeg-title-wrap' });
    this.titleEl = createElement('div', { className: 'horeg-track-title', textContent: 'No Track Loaded' });
    this.titleWrap.appendChild(this.titleEl);

    this.artistEl = createElement('div', { className: 'horeg-track-artist', textContent: 'Unknown Artist' });
    this.albumEl = createElement('div', { className: 'horeg-track-album', textContent: '' });

    metaWrap.appendChild(this.titleWrap);
    metaWrap.appendChild(this.artistEl);
    metaWrap.appendChild(this.albumEl);

    contentWrap.appendChild(this.stageContainer);
    contentWrap.appendChild(metaWrap);

    // 3. Progress / Scrubber Row
    const progressContainer = createElement('div', { className: 'horeg-progress-container' });
    const timeRow = createElement('div', { className: 'horeg-time-row' });
    this.currentTimeEl = createElement('span', { textContent: '00:00' });
    this.durationEl = createElement('span', { textContent: '00:00' });
    timeRow.appendChild(this.currentTimeEl);
    timeRow.appendChild(this.durationEl);
    progressContainer.appendChild(timeRow);

    this.sliderTrack = createElement('div', {
      className: 'horeg-slider-track',
      attributes: {
        role: 'slider',
        'aria-label': 'Seek progress',
        'aria-valuemin': '0',
        'aria-valuemax': '100',
        'aria-valuenow': '0',
        tabindex: '0'
      }
    });
    this.bufferBar = createElement('div', { className: 'horeg-buffer-bar' });
    this.fillBar = createElement('div', { className: 'horeg-fill-bar' });
    this.sliderTrack.appendChild(this.bufferBar);
    this.sliderTrack.appendChild(this.fillBar);
    progressContainer.appendChild(this.sliderTrack);
    contentWrap.appendChild(progressContainer);

    // 4. Controls Row
    const controlsRow = createElement('div', { className: 'horeg-controls-row' });

    // Side left: Shuffle & Repeat
    const leftControls = createElement('div', { className: 'horeg-side-controls' });
    this.shuffleBtn = createElement('button', {
      className: 'horeg-btn',
      attributes: { 'aria-label': 'Toggle shuffle', 'data-tooltip': 'Shuffle (S)', type: 'button' },
      innerHTML: ICONS.shuffle
    });
    this.loopBtn = createElement('button', {
      className: 'horeg-btn active',
      attributes: { 'aria-label': 'Toggle loop mode', 'data-tooltip': 'Repeat All (L)', type: 'button' },
      innerHTML: ICONS.repeat
    });
    leftControls.appendChild(this.shuffleBtn);
    leftControls.appendChild(this.loopBtn);
    controlsRow.appendChild(leftControls);

    // Center: Prev, Play, Next
    const centerControls = createElement('div', { className: 'horeg-center-controls' });
    this.prevBtn = createElement('button', {
      className: 'horeg-btn',
      attributes: { 'aria-label': 'Previous track', 'data-tooltip': 'Previous (K)', type: 'button' },
      innerHTML: ICONS.prev
    });
    this.playBtn = createElement('button', {
      className: 'horeg-btn horeg-btn-play',
      attributes: { 'aria-label': 'Play track', 'data-tooltip': 'Play (Space)', type: 'button' },
      innerHTML: ICONS.play
    });
    this.nextBtn = createElement('button', {
      className: 'horeg-btn',
      attributes: { 'aria-label': 'Next track', 'data-tooltip': 'Next (J)', type: 'button' },
      innerHTML: ICONS.next
    });
    centerControls.appendChild(this.prevBtn);
    centerControls.appendChild(this.playBtn);
    centerControls.appendChild(this.nextBtn);
    controlsRow.appendChild(centerControls);

    // Side right: Bass Booster, Volume Dropup & Drawer toggle
    const rightControls = createElement('div', { className: 'horeg-side-controls' });

    if (enableBass) {
      this.bassWrap = createElement('div', { className: 'horeg-bass-wrap' });
      this.bassBtn = createElement('button', {
        className: `horeg-btn horeg-btn-bass ${this.currentBass !== 0 ? 'active' : ''}`,
        attributes: {
          'aria-label': `Bass: ${this.formatBassDb(this.currentBass)}`,
          'data-tooltip': `Bass: ${this.formatBassDb(this.currentBass)}`,
          type: 'button'
        },
        innerHTML: ICONS.bass
      });
      this.bassDropup = createElement('div', { className: 'horeg-bass-dropup' });

      const bassHeader = createElement('div', { className: 'horeg-bass-header' });
      const bassLabel = createElement('span', { className: 'horeg-bass-label', textContent: 'BASS' });
      this.bassDbEl = createElement('span', {
        className: `horeg-bass-db ${this.currentBass > 0 ? 'is-boosted' : this.currentBass < 0 ? 'is-cut' : ''} ${this.currentBass >= 10 ? 'is-horeg' : ''}`,
        textContent: this.formatBassDb(this.currentBass)
      });
      bassHeader.appendChild(bassLabel);
      bassHeader.appendChild(this.bassDbEl);

      this.bassSlider = createElement('input', {
        className: 'horeg-bass-slider-vertical',
        attributes: {
          type: 'range',
          min: '-10',
          max: '15',
          step: '1',
          value: this.currentBass.toString(),
          orient: 'vertical',
          'aria-label': 'Bass booster fader'
        }
      });

      this.megaBassBtn = createElement('button', {
        className: `horeg-btn-mega-bass ${this.currentBass >= 12 ? 'active' : ''}`,
        attributes: {
          type: 'button',
          'aria-label': 'Toggle Mega Bass +12 dB',
          'data-tooltip': 'Mega Bass (+12 dB)'
        },
        innerHTML: /* html */ `<span class="horeg-mega-led"></span><span>MEGA</span>`
      });

      this.bassDropup.appendChild(bassHeader);
      this.bassDropup.appendChild(this.bassSlider);
      this.bassDropup.appendChild(this.megaBassBtn);

      this.bassWrap.appendChild(this.bassBtn);
      this.bassWrap.appendChild(this.bassDropup);
      rightControls.appendChild(this.bassWrap);
    }
    this.volumeWrap = createElement('div', { className: 'horeg-volume-wrap' });
    this.muteBtn = createElement('button', {
      className: 'horeg-btn',
      attributes: { 'aria-label': 'Toggle mute', 'data-tooltip': 'Volume 80% (M)', type: 'button' },
      innerHTML: ICONS.volumeHigh
    });
    this.volumeDropup = createElement('div', { className: 'horeg-volume-dropup' });
    this.volumePercentEl = createElement('span', { className: 'horeg-volume-percent', textContent: '80%' });
    this.volumeSlider = createElement('input', {
      className: 'horeg-volume-slider-vertical',
      attributes: {
        type: 'range',
        min: '0',
        max: '1',
        step: '0.01',
        value: '0.8',
        orient: 'vertical',
        'aria-label': 'Volume control'
      }
    });
    this.volumeDropup.appendChild(this.volumePercentEl);
    this.volumeDropup.appendChild(this.volumeSlider);

    this.volumeWrap.appendChild(this.muteBtn);
    this.volumeWrap.appendChild(this.volumeDropup);
    rightControls.appendChild(this.volumeWrap);

    this.drawerBtn = createElement('button', {
      className: 'horeg-btn',
      attributes: { 'aria-label': 'Toggle playlist drawer', 'data-tooltip': 'Playlist', type: 'button' },
      innerHTML: ICONS.playlist
    });
    rightControls.appendChild(this.drawerBtn);
    controlsRow.appendChild(rightControls);

    contentWrap.appendChild(controlsRow);

    // 5. Drawer panel
    this.drawerEl = createElement('div', { className: 'horeg-drawer' });

    // Drawer Header with count & Add Track button
    const drawerHeader = createElement('div', { className: 'horeg-drawer-header' });
    const drawerHeading = createElement('div', { className: 'horeg-drawer-heading' });
    drawerHeading.innerHTML = /* html */ `<span>PLAYLIST</span>`;
    this.drawerCountEl = createElement('span', { className: 'horeg-drawer-count', textContent: '0' });
    drawerHeading.appendChild(this.drawerCountEl);
    drawerHeader.appendChild(drawerHeading);

    this.addTrackBtn = createElement('button', {
      className: 'horeg-btn-add-track',
      attributes: { type: 'button', 'aria-label': 'Add track to playlist', 'data-tooltip': 'Add Track' },
      innerHTML: /* html */ `${ICONS.plus} <span>Add Track</span>`
    });
    drawerHeader.appendChild(this.addTrackBtn);
    this.drawerEl.appendChild(drawerHeader);

    // Add Track Accordion Panel
    this.addPanelEl = createElement('div', { className: 'horeg-add-panel' });

    // Tabs
    const tabs = createElement('div', { className: 'horeg-add-tabs' });
    this.tabBtnFile = createElement('button', {
      className: 'horeg-tab-btn active',
      attributes: { type: 'button' },
      innerHTML: /* html */ `${ICONS.upload} <span>Local File</span>`
    });
    this.tabBtnUrl = createElement('button', {
      className: 'horeg-tab-btn',
      attributes: { type: 'button' },
      innerHTML: /* html */ `${ICONS.link} <span>Audio URL</span>`
    });
    tabs.appendChild(this.tabBtnFile);
    tabs.appendChild(this.tabBtnUrl);
    this.addPanelEl.appendChild(tabs);

    // Tab 1: Local File Dropzone & Hidden Input
    this.tabPaneFile = createElement('div', { className: 'horeg-tab-pane active' });
    this.fileInputEl = createElement('input', {
      attributes: { type: 'file', accept: 'audio/*', multiple: 'true', style: 'display: none;' }
    });
    this.dropzoneEl = createElement('div', { className: 'horeg-dropzone' });
    this.dropzoneEl.innerHTML = /* html */ `
      <div class="horeg-dropzone-icon">${ICONS.upload}</div>
      <div class="horeg-dropzone-text">Choose Local Audio File</div>
      <div class="horeg-dropzone-hint">Click here or drag & drop audio files (.mp3, .wav, .flac, .ogg, .m4a)</div>
    `;
    this.tabPaneFile.appendChild(this.fileInputEl);
    this.tabPaneFile.appendChild(this.dropzoneEl);
    this.addPanelEl.appendChild(this.tabPaneFile);

    // Tab 2: URL Form
    this.tabPaneUrl = createElement('div', { className: 'horeg-tab-pane' });
    this.urlInput = createElement('input', {
      className: 'horeg-input-field',
      attributes: { type: 'url', placeholder: 'Audio URL (https://...mp3/wav)', required: 'true' }
    });
    this.titleInput = createElement('input', {
      className: 'horeg-input-field',
      attributes: { type: 'text', placeholder: 'Track Title (Optional)' }
    });
    this.artistInput = createElement('input', {
      className: 'horeg-input-field',
      attributes: { type: 'text', placeholder: 'Artist Name (Optional)' }
    });
    const formActions = createElement('div', { className: 'horeg-form-actions' });
    this.cancelAddBtn = createElement('button', {
      className: 'horeg-btn-cancel',
      attributes: { type: 'button' },
      textContent: 'Cancel'
    });
    this.submitUrlBtn = createElement('button', {
      className: 'horeg-btn-submit',
      attributes: { type: 'button' },
      innerHTML: /* html */ `${ICONS.plus} Add Track`
    });
    formActions.appendChild(this.cancelAddBtn);
    formActions.appendChild(this.submitUrlBtn);

    this.tabPaneUrl.appendChild(this.urlInput);
    this.tabPaneUrl.appendChild(this.titleInput);
    this.tabPaneUrl.appendChild(this.artistInput);
    this.tabPaneUrl.appendChild(formActions);
    this.addPanelEl.appendChild(this.tabPaneUrl);

    this.drawerEl.appendChild(this.addPanelEl);

    // Track list container
    this.drawerInner = createElement('div', { className: 'horeg-drawer-inner' });
    this.drawerEl.appendChild(this.drawerInner);
    this.root.appendChild(this.drawerEl);

    this.bindDOMEvents();
  }

  private bindDOMEvents(): void {
    this.playBtn.addEventListener('click', () => this.events.onPlayPauseClick());
    this.prevBtn.addEventListener('click', () => this.events.onPrevClick());
    this.nextBtn.addEventListener('click', () => this.events.onNextClick());
    this.shuffleBtn.addEventListener('click', () => this.events.onShuffleToggle());
    this.loopBtn.addEventListener('click', () => this.events.onLoopToggle());
    this.muteBtn.addEventListener('click', () => this.events.onMuteToggle());

    this.volumeSlider.addEventListener('input', () => {
      const val = parseFloat(this.volumeSlider.value);
      this.events.onVolumeChange(val);
      const percent = Math.round(val * 100);
      this.volumePercentEl.textContent = val === 0 ? 'MUTE' : `${percent}%`;
    });

    if (this.bassSlider) {
      this.bassSlider.addEventListener('input', () => {
        const val = parseInt(this.bassSlider!.value, 10) || 0;
        this.currentBass = val;
        this.updateBass(val, false);
        if (this.events.onBassChange) {
          this.events.onBassChange(val);
        }
      });
    }

    if (this.megaBassBtn) {
      this.megaBassBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetVal = this.currentBass >= 12 ? 0 : 12;
        this.currentBass = targetVal;
        this.updateBass(targetVal, true);
        if (this.events.onBassChange) {
          this.events.onBassChange(targetVal);
        }
      });
    }

    if (this.bassBtn && this.bassWrap) {
      this.bassBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.bassWrap?.classList.toggle('open');
      });

      this.root.addEventListener('click', (e) => {
        const path = e.composedPath ? e.composedPath() : [];
        if (this.bassWrap && !path.includes(this.bassWrap)) {
          this.bassWrap.classList.remove('open');
        }
      });
    }

    this.drawerBtn.addEventListener('click', () => {
      this.toggleDrawer();
    });

    // Toggle Add Track Form
    this.addTrackBtn.addEventListener('click', () => {
      const isOpen = this.addPanelEl.classList.toggle('open');
      this.addTrackBtn.classList.toggle('active', isOpen);
      if (isOpen) {
        this.toggleDrawer(true);
      }
    });

    // Tab Switchers
    this.tabBtnFile.addEventListener('click', () => {
      this.tabBtnFile.classList.add('active');
      this.tabBtnUrl.classList.remove('active');
      this.tabPaneFile.classList.add('active');
      this.tabPaneUrl.classList.remove('active');
    });

    this.tabBtnUrl.addEventListener('click', () => {
      this.tabBtnUrl.classList.add('active');
      this.tabBtnFile.classList.remove('active');
      this.tabPaneUrl.classList.add('active');
      this.tabPaneFile.classList.remove('active');
      this.urlInput.focus();
    });

    // Local file picker
    this.dropzoneEl.addEventListener('click', () => {
      this.fileInputEl.click();
    });

    this.fileInputEl.addEventListener('change', () => {
      if (this.fileInputEl.files && this.fileInputEl.files.length > 0) {
        const files = Array.from(this.fileInputEl.files);
        if (this.events.onAddTrackFiles) {
          this.events.onAddTrackFiles(files);
        }
        this.fileInputEl.value = '';
        this.closeAddPanel();
      }
    });

    // Dropzone drag-and-drop feedback
    this.dropzoneEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dropzoneEl.classList.add('drag-active');
    });

    this.dropzoneEl.addEventListener('dragleave', () => {
      this.dropzoneEl.classList.remove('drag-active');
    });

    this.dropzoneEl.addEventListener('drop', (e) => {
      e.preventDefault();
      this.dropzoneEl.classList.remove('drag-active');
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const audioFiles = Array.from(e.dataTransfer.files).filter(
          (f) => f.type.startsWith('audio/') || /\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(f.name)
        );
        if (audioFiles.length > 0 && this.events.onAddTrackFiles) {
          this.events.onAddTrackFiles(audioFiles);
          this.closeAddPanel();
        }
      }
    });

    // Whole player Drag & Drop listener
    this.root.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.root.classList.add('drag-over');
    });

    this.root.addEventListener('dragleave', (e) => {
      if (!this.root.contains(e.relatedTarget as Node)) {
        this.root.classList.remove('drag-over');
      }
    });

    this.root.addEventListener('drop', (e) => {
      e.preventDefault();
      this.root.classList.remove('drag-over');
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const audioFiles = Array.from(e.dataTransfer.files).filter(
          (f) => f.type.startsWith('audio/') || /\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(f.name)
        );
        if (audioFiles.length > 0 && this.events.onAddTrackFiles) {
          this.events.onAddTrackFiles(audioFiles);
          this.closeAddPanel();
        }
      }
    });

    // URL Form Submission
    const handleUrlSubmit = () => {
      const url = this.urlInput.value.trim();
      if (!url) {
        this.urlInput.focus();
        return;
      }
      const title = this.titleInput.value.trim();
      const artist = this.artistInput.value.trim();
      if (this.events.onAddTrackUrl) {
        this.events.onAddTrackUrl(url, title || undefined, artist || undefined);
      }
      this.urlInput.value = '';
      this.titleInput.value = '';
      this.artistInput.value = '';
      this.closeAddPanel();
    };

    this.submitUrlBtn.addEventListener('click', handleUrlSubmit);
    const handleUrlInputKeyDown = (e: KeyboardEvent) => {
      // Allow space, arrows, and text navigation without triggering player shortcuts
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        handleUrlSubmit();
      }
    };

    this.urlInput.addEventListener('keydown', handleUrlInputKeyDown);
    this.titleInput.addEventListener('keydown', handleUrlInputKeyDown);
    this.artistInput.addEventListener('keydown', handleUrlInputKeyDown);

    this.cancelAddBtn.addEventListener('click', () => {
      this.closeAddPanel();
    });

    // Scrubbing on slider track
    this.sliderTrack.addEventListener('mousedown', this.startScrubbing);
    this.sliderTrack.addEventListener('touchstart', this.startScrubbing, { passive: false });

    // Keyboard support on slider
    this.sliderTrack.addEventListener('keydown', (e: KeyboardEvent) => {
      if (!this.currentDuration) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        const cur = (parseFloat(this.fillBar.style.width) / 100) * this.currentDuration;
        this.events.onSeek(Math.min(cur + 5, this.currentDuration));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        const cur = (parseFloat(this.fillBar.style.width) / 100) * this.currentDuration;
        this.events.onSeek(Math.max(cur - 5, 0));
      }
    });
  }

  private startScrubbing = (e: MouseEvent | TouchEvent): void => {
    e.preventDefault();
    this.isScrubbing = true;
    document.body.style.userSelect = 'none';

    this.handleScrubbingMove(e);

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      if (this.isScrubbing) {
        this.handleScrubbingMove(moveEvent);
      }
    };

    const onUp = (upEvent: MouseEvent | TouchEvent) => {
      if (this.isScrubbing) {
        this.finishScrubbing(upEvent);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onUp);
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  };

  private calculateProgressPercent(e: MouseEvent | TouchEvent): number {
    const rect = this.sliderTrack.getBoundingClientRect();
    const clientX =
      'touches' in e
        ? ((e as TouchEvent).touches?.[0]?.clientX ?? (e as TouchEvent).changedTouches?.[0]?.clientX ?? 0)
        : (e as MouseEvent).clientX;
    const offsetX = clamp(clientX - rect.left, 0, rect.width);
    return rect.width > 0 ? (offsetX / rect.width) * 100 : 0;
  }

  private handleScrubbingMove(e: MouseEvent | TouchEvent): void {
    const percent = this.calculateProgressPercent(e);
    this.fillBar.style.width = `${percent}%`;
    this.sliderTrack.setAttribute('aria-valuenow', Math.round(percent).toString());
    if (this.currentDuration > 0) {
      const seekTime = (percent / 100) * this.currentDuration;
      this.currentTimeEl.textContent = formatTime(seekTime);
    }
  }

  private finishScrubbing(e: MouseEvent | TouchEvent): void {
    const percent = this.calculateProgressPercent(e);
    this.fillBar.style.width = `${percent}%`;
    this.sliderTrack.setAttribute('aria-valuenow', Math.round(percent).toString());
    if (this.currentDuration > 0) {
      const targetSeconds = (percent / 100) * this.currentDuration;
      this.currentTimeEl.textContent = formatTime(targetSeconds);
      this.events.onSeek(targetSeconds);
    }
    this.isScrubbing = false;
    document.body.style.userSelect = '';
  }

  public updateTrackInfo(track: Track): void {
    this.titleEl.textContent = track.title || 'Untitled Track';
    this.artistEl.textContent = track.artist || 'Unknown Artist';
    this.albumEl.textContent = track.album || '';

    if (track.coverArt) {
      this.coverContainer.innerHTML = '';
      this.coverImgEl = createElement('img', {
        className: 'horeg-cover-img',
        attributes: {
          src: track.coverArt,
          alt: `${track.title} cover`
        }
      });
      this.coverImgEl.onerror = () => {
        this.coverContainer.innerHTML = /* html */ `<span class="horeg-cover-fallback">${ICONS.speaker}</span>`;
      };
      this.coverContainer.appendChild(this.coverImgEl);
    } else {
      this.coverContainer.innerHTML = /* html */ `<span class="horeg-cover-fallback">${ICONS.speaker}</span>`;
    }

    this.checkTitleMarquee();
  }

  public checkTitleMarquee(): void {
    if (!this.titleEl || !this.titleWrap) return;
    this.titleEl.classList.remove('is-marquee');
    this.titleWrap.classList.remove('is-overflowing');
    this.titleWrap.style.removeProperty('--marquee-dist');
    this.titleWrap.style.removeProperty('--marquee-duration');
    this.titleEl.style.removeProperty('--marquee-dist');
    this.titleEl.style.removeProperty('--marquee-duration');

    requestAnimationFrame(() => {
      const titleWidth = this.titleEl.scrollWidth;
      const wrapWidth = this.titleWrap.clientWidth;
      if (titleWidth > wrapWidth && wrapWidth > 0) {
        const overflowDist = titleWidth - wrapWidth + 20;
        const duration = Math.max(6, Math.round(overflowDist / 18) + 3);
        const distVal = `-${overflowDist}px`;
        const durVal = `${duration}s`;

        this.titleWrap.style.setProperty('--marquee-dist', distVal);
        this.titleWrap.style.setProperty('--marquee-duration', durVal);
        this.titleEl.style.setProperty('--marquee-dist', distVal);
        this.titleEl.style.setProperty('--marquee-duration', durVal);

        this.titleWrap.classList.add('is-overflowing');
        this.titleEl.classList.add('is-marquee');
      }
    });
  }

  public updatePlayState(isPlaying: boolean): void {
    if (isPlaying) {
      this.playBtn.classList.add('playing');
      this.playBtn.innerHTML = ICONS.pause;
      this.playBtn.setAttribute('aria-label', 'Pause track');
      this.playBtn.setAttribute('data-tooltip', 'Pause (Space)');
    } else {
      this.playBtn.classList.remove('playing');
      this.playBtn.innerHTML = ICONS.play;
      this.playBtn.setAttribute('aria-label', 'Play track');
      this.playBtn.setAttribute('data-tooltip', 'Play (Space)');
    }
  }

  public updateProgress(currentTime: number, duration: number): void {
    this.currentDuration = duration;
    this.durationEl.textContent = formatTime(duration);

    if (!this.isScrubbing) {
      this.currentTimeEl.textContent = formatTime(currentTime);
      const percent = duration > 0 ? (currentTime / duration) * 100 : 0;
      this.fillBar.style.width = `${clamp(percent, 0, 100)}%`;
      this.sliderTrack.setAttribute('aria-valuenow', Math.round(percent).toString());
    }
  }

  public updateBuffer(percent: number): void {
    this.bufferBar.style.width = `${clamp(percent, 0, 100)}%`;
  }

  public updateVolume(volume: number, isMuted: boolean): void {
    this.volumeSlider.value = volume.toString();
    const percent = Math.round(volume * 100);

    if (isMuted || volume === 0) {
      this.muteBtn.innerHTML = ICONS.volumeMute;
      this.muteBtn.setAttribute('aria-label', 'Unmute');
      this.muteBtn.setAttribute('data-tooltip', 'Unmute (M)');
      this.volumePercentEl.textContent = 'MUTE';
    } else {
      this.volumePercentEl.textContent = `${percent}%`;
      this.muteBtn.setAttribute('data-tooltip', `Volume ${percent}% (M)`);
      if (volume <= 0.35) {
        this.muteBtn.innerHTML = ICONS.volumeLow;
        this.muteBtn.setAttribute('aria-label', 'Volume low');
      } else if (volume <= 0.70) {
        this.muteBtn.innerHTML = ICONS.volumeMedium;
        this.muteBtn.setAttribute('aria-label', 'Volume medium');
      } else {
        this.muteBtn.innerHTML = ICONS.volumeHigh;
        this.muteBtn.setAttribute('aria-label', 'Volume high');
      }
    }
  }

  public formatBassDb(db: number): string {
    if (db > 0) return `+${db} dB`;
    return `${db} dB`;
  }

  public updateBass(gainDb: number, updateSlider: boolean = true): void {
    this.currentBass = clamp(gainDb, -10, 15);
    const text = this.formatBassDb(this.currentBass);
    if (this.bassDbEl) {
      this.bassDbEl.textContent = text;
      this.bassDbEl.classList.toggle('is-boosted', this.currentBass > 0);
      this.bassDbEl.classList.toggle('is-cut', this.currentBass < 0);
      this.bassDbEl.classList.toggle('is-horeg', this.currentBass >= 10);
    }
    if (updateSlider && this.bassSlider) {
      this.bassSlider.value = this.currentBass.toString();
    }
    if (this.megaBassBtn) {
      this.megaBassBtn.classList.toggle('active', this.currentBass >= 12);
    }
    if (this.bassBtn) {
      this.bassBtn.classList.toggle('active', this.currentBass !== 0);
      const isHoreg = this.currentBass >= 10;
      const tooltipText = isHoreg ? `Bass: ${text} 🔥` : `Bass: ${text}`;
      this.bassBtn.setAttribute('data-tooltip', tooltipText);
      this.bassBtn.setAttribute('aria-label', tooltipText);
    }
  }

  public updateLoopState(mode: LoopMode): void {
    if (mode === 'none') {
      this.loopBtn.classList.remove('active');
      this.loopBtn.innerHTML = ICONS.repeat;
      this.loopBtn.setAttribute('data-tooltip', 'Repeat Off (L)');
    } else if (mode === 'all') {
      this.loopBtn.classList.add('active');
      this.loopBtn.innerHTML = ICONS.repeat;
      this.loopBtn.setAttribute('data-tooltip', 'Repeat All (L)');
    } else if (mode === 'one') {
      this.loopBtn.classList.add('active');
      this.loopBtn.innerHTML = ICONS.repeatOne;
      this.loopBtn.setAttribute('data-tooltip', 'Repeat One (L)');
    }
    this.loopBtn.setAttribute('aria-label', `Repeat mode: ${mode}`);
  }

  public updateShuffleState(isShuffle: boolean): void {
    if (isShuffle) {
      this.shuffleBtn.classList.add('active');
      this.shuffleBtn.setAttribute('data-tooltip', 'Shuffle Off (S)');
    } else {
      this.shuffleBtn.classList.remove('active');
      this.shuffleBtn.setAttribute('data-tooltip', 'Shuffle (S)');
    }
  }

  public toggleDrawer(open?: boolean): void {
    const shouldOpen = open !== undefined ? open : !this.drawerEl.classList.contains('open');
    if (shouldOpen) {
      this.drawerEl.classList.add('open');
      this.drawerBtn.classList.add('active');
    } else {
      this.drawerEl.classList.remove('open');
      this.drawerBtn.classList.remove('active');
      this.closeAddPanel();
    }
  }

  public closeAddPanel(): void {
    this.addPanelEl.classList.remove('open');
    this.addTrackBtn.classList.remove('active');
  }

  public renderPlaylist(playlist: Track[], currentIndex: number): void {
    this.drawerCountEl.textContent = playlist.length.toString();
    this.drawerInner.innerHTML = '';

    if (playlist.length === 0) {
      const emptyEl = createElement('div', {
        className: 'horeg-empty-playlist',
        textContent: 'Playlist is empty. Click "Add Track" to add music.'
      });
      this.drawerInner.appendChild(emptyEl);
      return;
    }

    playlist.forEach((track, idx) => {
      const item = createElement('div', {
        className: `horeg-track-item ${idx === currentIndex ? 'active' : ''}`
      });

      const num = createElement('div', {
        className: 'horeg-track-num',
        textContent: (idx + 1).toString().padStart(2, '0')
      });
      item.appendChild(num);

      const details = createElement('div', { className: 'horeg-track-details' });
      const title = createElement('div', {
        className: 'horeg-item-title',
        textContent: track.title
      });
      const artist = createElement('div', {
        className: 'horeg-item-artist',
        textContent: track.artist || 'Unknown Artist'
      });
      details.appendChild(title);
      details.appendChild(artist);
      item.appendChild(details);

      if (track.duration) {
        const dur = createElement('div', {
          className: 'horeg-item-duration',
          textContent: formatTime(track.duration)
        });
        item.appendChild(dur);
      }

      // Remove / delete button
      const actions = createElement('div', { className: 'horeg-track-actions' });
      const removeBtn = createElement('button', {
        className: 'horeg-btn-remove',
        attributes: { type: 'button', 'aria-label': 'Remove track from playlist', 'data-tooltip': 'Remove' },
        innerHTML: ICONS.trash
      });
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.events.onRemoveTrack) {
          this.events.onRemoveTrack(idx);
        }
      });
      actions.appendChild(removeBtn);
      item.appendChild(actions);

      item.addEventListener('click', () => {
        this.events.onTrackSelect(idx);
      });

      this.drawerInner.appendChild(item);
    });
  }

  public destroy(): void {
    this.root.remove();
  }
}

