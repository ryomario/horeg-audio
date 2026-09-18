import { ref, shallowRef, onMounted, onUnmounted, getCurrentInstance } from 'vue';
import { HoregCore, HoregCoreOptions, HoregCoreState } from '../../core/src/HoregCore';
import { Track, LoopMode, EqPreset, EqBand } from '../../../src/types';
import { AudioEnergy } from '../../../src/AudioEngine';

export interface UseHoregAudioVueOptions extends HoregCoreOptions {
  core?: HoregCore;
}

export function useHoregAudio(options: UseHoregAudioVueOptions = {}) {
  const isInternal = !options.core;
  const core = options.core || new HoregCore(options);
  const coreRef = shallowRef<HoregCore>(core);

  const initialState = core.getState();
  const isPlaying = ref<boolean>(initialState.isPlaying);
  const isLoading = ref<boolean>(initialState.isLoading);
  const currentTrack = ref<Track | null>(initialState.currentTrack);
  const currentIndex = ref<number>(initialState.currentIndex);
  const playlist = ref<Track[]>(initialState.playlist);
  const currentTime = ref<number>(initialState.currentTime);
  const duration = ref<number>(initialState.duration);
  const bufferedPercent = ref<number>(initialState.bufferedPercent);
  const volume = ref<number>(initialState.volume);
  const isMuted = ref<boolean>(initialState.isMuted);
  const bass = ref<number>(initialState.bass);
  const loopMode = ref<LoopMode>(initialState.loopMode);
  const isShuffle = ref<boolean>(initialState.isShuffle);
  const eqPreset = ref<EqPreset>(initialState.eqPreset);
  const bandGains = ref<Record<EqBand, number>>({ ...initialState.bandGains });
  const error = ref<Error | null>(initialState.error);
  const audioEnergy = ref<AudioEnergy>({ bass: 0, midHigh: 0, left: 0, right: 0 });

  let unsubscribe: (() => void) | null = null;

  const syncState = (s: HoregCoreState) => {
    isPlaying.value = s.isPlaying;
    isLoading.value = s.isLoading;
    currentTrack.value = s.currentTrack;
    currentIndex.value = s.currentIndex;
    playlist.value = s.playlist;
    currentTime.value = s.currentTime;
    duration.value = s.duration;
    bufferedPercent.value = s.bufferedPercent;
    volume.value = s.volume;
    isMuted.value = s.isMuted;
    bass.value = s.bass;
    loopMode.value = s.loopMode;
    isShuffle.value = s.isShuffle;
    eqPreset.value = s.eqPreset;
    bandGains.value = { ...s.bandGains };
    error.value = s.error;
    audioEnergy.value = core.getAudioEnergy();
  };

  const instance = getCurrentInstance();
  if (instance) {
    onMounted(() => {
      unsubscribe = core.subscribe(syncState);
    });

    onUnmounted(() => {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      if (isInternal) {
        core.destroy();
      }
    });
  } else {
    // Standalone / Pinia store / SSR context
    unsubscribe = core.subscribe(syncState);
  }

  const play = async () => core.play();
  const pause = () => core.pause();
  const togglePlay = async () => core.togglePlay();
  const seek = (seconds: number) => core.seek(seconds);
  const next = () => core.next();
  const prev = () => core.prev();
  const setTrack = (index: number, autoPlay: boolean = true) => core.setTrack(index, autoPlay);
  const setVolume = (val: number) => core.setVolume(val);
  const setBass = (val: number) => core.setBass(val);
  const setLoop = (mode: LoopMode) => core.setLoop(mode);
  const toggleLoop = () => core.toggleLoop();
  const setShuffle = (enabled: boolean) => core.setShuffle(enabled);
  const toggleShuffle = () => core.toggleShuffle();
  const setEqPreset = (preset: EqPreset) => core.setEqPreset(preset);
  const setBandGain = (band: EqBand, gainDb: number) => core.setBandGain(band, gainDb);
  const getAudioEnergy = () => core.getAudioEnergy();

  return {
    core: coreRef,
    isPlaying,
    isLoading,
    currentTrack,
    currentIndex,
    playlist,
    currentTime,
    duration,
    bufferedPercent,
    volume,
    isMuted,
    bass,
    loopMode,
    isShuffle,
    eqPreset,
    bandGains,
    audioEnergy,
    error,
    play,
    pause,
    togglePlay,
    seek,
    next,
    prev,
    setTrack,
    setVolume,
    setBass,
    setLoop,
    toggleLoop,
    setShuffle,
    toggleShuffle,
    setEqPreset,
    setBandGain,
    getAudioEnergy
  };
}
