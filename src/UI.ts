import { Track, LoopMode } from './types';
import { formatTime, clamp } from './utils/time';
import { ICONS, createElement } from './utils/dom';

export interface UIEvents {
  onPlayPauseClick: () => void;
  onPrevClick: () => void;
  onNextClick: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onShuffleToggle: () => void;
  onLoopToggle: () => void;
  onTrackSelect: (index: number) => void;
  onAddTrackFiles?: (files: File[]) => void;
  onAddTrackUrl?: (url: string, title?: string, artist?: string) => void;
  onRemoveTrack?: (index: number) => void;
}

export class UI {
  public root: HTMLElement;
  public eqContainer: HTMLElement;

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
  private coverContainer: HTMLElement;

  private currentTimeEl: HTMLElement;
  private durationEl: HTMLElement;
  private sliderTrack: HTMLElement;
  private fillBar: HTMLElement;
  private bufferBar: HTMLElement;

  private volumeSlider: HTMLInputElement;
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

  constructor(events: UIEvents) {
    this.events = events;

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
      innerHTML: `<span class="horeg-badge-led"></span> HOREG RIG • HIGH VOLTAGE`
    });
    header.appendChild(badge);
    contentWrap.appendChild(header);

    // 2. Track row (Cover art, metadata, visualizer)
    const trackRow = createElement('div', { className: 'horeg-track-row' });
    this.coverContainer = createElement('div', { className: 'horeg-cover-container' });
    this.coverContainer.innerHTML = `<span class="horeg-cover-fallback">${ICONS.speaker}</span>`;
    trackRow.appendChild(this.coverContainer);

    const trackInfo = createElement('div', { className: 'horeg-track-info' });
    this.titleEl = createElement('div', { className: 'horeg-track-title', textContent: 'No Track Loaded' });
    this.artistEl = createElement('div', { className: 'horeg-track-artist', textContent: 'Unknown Artist' });
    this.albumEl = createElement('div', { className: 'horeg-track-album', textContent: '' });
    trackInfo.appendChild(this.titleEl);
    trackInfo.appendChild(this.artistEl);
    trackInfo.appendChild(this.albumEl);
    trackRow.appendChild(trackInfo);

    this.eqContainer = createElement('div', { className: 'horeg-eq-wrapper' });
    trackRow.appendChild(this.eqContainer);
    contentWrap.appendChild(trackRow);

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
      attributes: { 'aria-label': 'Toggle shuffle', type: 'button' },
      innerHTML: ICONS.shuffle
    });
    this.loopBtn = createElement('button', {
      className: 'horeg-btn active',
      attributes: { 'aria-label': 'Toggle loop mode', type: 'button' },
      innerHTML: ICONS.repeat
    });
    leftControls.appendChild(this.shuffleBtn);
    leftControls.appendChild(this.loopBtn);
    controlsRow.appendChild(leftControls);

    // Center: Prev, Play, Next
    const centerControls = createElement('div', { className: 'horeg-center-controls' });
    this.prevBtn = createElement('button', {
      className: 'horeg-btn',
      attributes: { 'aria-label': 'Previous track', type: 'button' },
      innerHTML: ICONS.prev
    });
    this.playBtn = createElement('button', {
      className: 'horeg-btn horeg-btn-play',
      attributes: { 'aria-label': 'Play track', type: 'button' },
      innerHTML: ICONS.play
    });
    this.nextBtn = createElement('button', {
      className: 'horeg-btn',
      attributes: { 'aria-label': 'Next track', type: 'button' },
      innerHTML: ICONS.next
    });
    centerControls.appendChild(this.prevBtn);
    centerControls.appendChild(this.playBtn);
    centerControls.appendChild(this.nextBtn);
    controlsRow.appendChild(centerControls);

    // Side right: Volume & Drawer toggle
    const rightControls = createElement('div', { className: 'horeg-side-controls' });
    const volumeWrap = createElement('div', { className: 'horeg-volume-wrap' });
    this.muteBtn = createElement('button', {
      className: 'horeg-btn',
      attributes: { 'aria-label': 'Toggle mute', type: 'button' },
      innerHTML: ICONS.volumeHigh
    });
    this.volumeSlider = createElement('input', {
      className: 'horeg-volume-slider',
      attributes: {
        type: 'range',
        min: '0',
        max: '1',
        step: '0.01',
        value: '0.8',
        'aria-label': 'Volume control'
      }
    });
    volumeWrap.appendChild(this.muteBtn);
    volumeWrap.appendChild(this.volumeSlider);
    rightControls.appendChild(volumeWrap);

    this.drawerBtn = createElement('button', {
      className: 'horeg-btn',
      attributes: { 'aria-label': 'Toggle playlist drawer', type: 'button' },
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
    drawerHeading.innerHTML = `<span>PLAYLIST</span>`;
    this.drawerCountEl = createElement('span', { className: 'horeg-drawer-count', textContent: '0' });
    drawerHeading.appendChild(this.drawerCountEl);
    drawerHeader.appendChild(drawerHeading);

    this.addTrackBtn = createElement('button', {
      className: 'horeg-btn-add-track',
      attributes: { type: 'button', 'aria-label': 'Add track to playlist' },
      innerHTML: `${ICONS.plus} <span>Add Track</span>`
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
      innerHTML: `${ICONS.upload} <span>File Lokal</span>`
    });
    this.tabBtnUrl = createElement('button', {
      className: 'horeg-tab-btn',
      attributes: { type: 'button' },
      innerHTML: `${ICONS.link} <span>Audio URL</span>`
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
    this.dropzoneEl.innerHTML = `
      <div class="horeg-dropzone-icon">${ICONS.upload}</div>
      <div class="horeg-dropzone-text">Pilih File Audio Komputer</div>
      <div class="horeg-dropzone-hint">Klik di sini atau drag & drop file (.mp3, .wav, .flac, .ogg, .m4a)</div>
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
      attributes: { type: 'text', placeholder: 'Judul Lagu (Opsional)' }
    });
    this.artistInput = createElement('input', {
      className: 'horeg-input-field',
      attributes: { type: 'text', placeholder: 'Nama Artis (Opsional)' }
    });
    const formActions = createElement('div', { className: 'horeg-form-actions' });
    this.cancelAddBtn = createElement('button', {
      className: 'horeg-btn-cancel',
      attributes: { type: 'button' },
      textContent: 'Batal'
    });
    this.submitUrlBtn = createElement('button', {
      className: 'horeg-btn-submit',
      attributes: { type: 'button' },
      innerHTML: `${ICONS.plus} Tambah`
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
      this.events.onVolumeChange(parseFloat(this.volumeSlider.value));
    });

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
    this.urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleUrlSubmit();
      }
    });

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
    this.handleScrubbingMove(e);

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      if (this.isScrubbing) {
        this.handleScrubbingMove(moveEvent);
      }
    };

    const onUp = (upEvent: MouseEvent | TouchEvent) => {
      if (this.isScrubbing) {
        this.isScrubbing = false;
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
    const clientX = 'touches' in e ? (e.touches[0] || e.changedTouches[0]).clientX : e.clientX;
    const offsetX = clamp(clientX - rect.left, 0, rect.width);
    return rect.width > 0 ? (offsetX / rect.width) * 100 : 0;
  }

  private handleScrubbingMove(e: MouseEvent | TouchEvent): void {
    const percent = this.calculateProgressPercent(e);
    this.fillBar.style.width = `${percent}%`;
    if (this.currentDuration > 0) {
      const seekTime = (percent / 100) * this.currentDuration;
      this.currentTimeEl.textContent = formatTime(seekTime);
    }
  }

  private finishScrubbing(e: MouseEvent | TouchEvent): void {
    const percent = this.calculateProgressPercent(e);
    if (this.currentDuration > 0) {
      const targetSeconds = (percent / 100) * this.currentDuration;
      this.events.onSeek(targetSeconds);
    }
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
        this.coverContainer.innerHTML = `<span class="horeg-cover-fallback">${ICONS.speaker}</span>`;
      };
      this.coverContainer.appendChild(this.coverImgEl);
    } else {
      this.coverContainer.innerHTML = `<span class="horeg-cover-fallback">${ICONS.speaker}</span>`;
    }
  }

  public updatePlayState(isPlaying: boolean): void {
    if (isPlaying) {
      this.playBtn.classList.add('playing');
      this.playBtn.innerHTML = ICONS.pause;
      this.playBtn.setAttribute('aria-label', 'Pause track');
    } else {
      this.playBtn.classList.remove('playing');
      this.playBtn.innerHTML = ICONS.play;
      this.playBtn.setAttribute('aria-label', 'Play track');
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
    if (isMuted || volume === 0) {
      this.muteBtn.innerHTML = ICONS.volumeMute;
      this.muteBtn.setAttribute('aria-label', 'Unmute');
    } else {
      this.muteBtn.innerHTML = ICONS.volumeHigh;
      this.muteBtn.setAttribute('aria-label', 'Mute');
    }
  }

  public updateLoopState(mode: LoopMode): void {
    if (mode === 'none') {
      this.loopBtn.classList.remove('active');
      this.loopBtn.innerHTML = ICONS.repeat;
    } else if (mode === 'all') {
      this.loopBtn.classList.add('active');
      this.loopBtn.innerHTML = ICONS.repeat;
    } else if (mode === 'one') {
      this.loopBtn.classList.add('active');
      this.loopBtn.innerHTML = ICONS.repeatOne;
    }
    this.loopBtn.setAttribute('aria-label', `Repeat mode: ${mode}`);
  }

  public updateShuffleState(isShuffle: boolean): void {
    if (isShuffle) {
      this.shuffleBtn.classList.add('active');
    } else {
      this.shuffleBtn.classList.remove('active');
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
        textContent: 'Playlist masih kosong. Klik "Add Track" untuk menambahkan lagu.'
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
        attributes: { type: 'button', 'aria-label': 'Hapus lagu dari playlist' },
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

