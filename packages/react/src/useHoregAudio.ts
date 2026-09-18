import { useState, useEffect, useRef, useCallback } from 'react';
import { HoregCore, HoregCoreOptions, HoregCoreState } from '../../core/src/HoregCore';
import { LoopMode, EqPreset, EqBand } from '../../../src/types';
import { AudioEnergy } from '../../../src/AudioEngine';

export interface UseHoregAudioOptions extends HoregCoreOptions {
  core?: HoregCore;
}

export function useHoregAudio(options: UseHoregAudioOptions = {}) {
  const coreRef = useRef<HoregCore | null>(null);
  const isInternalCore = useRef<boolean>(false);

  if (!coreRef.current) {
    if (options.core) {
      coreRef.current = options.core;
      isInternalCore.current = false;
    } else {
      coreRef.current = new HoregCore(options);
      isInternalCore.current = true;
    }
  }

  const [state, setState] = useState<HoregCoreState>(() => coreRef.current!.getState());

  useEffect(() => {
    const core = coreRef.current!;
    const unsubscribe = core.subscribe((nextState) => {
      setState(nextState);
    });

    return () => {
      unsubscribe();
      if (isInternalCore.current) {
        core.destroy();
      }
    };
  }, []);

  const play = useCallback(async () => {
    return coreRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    coreRef.current?.pause();
  }, []);

  const togglePlay = useCallback(async () => {
    return coreRef.current?.togglePlay();
  }, []);

  const seek = useCallback((seconds: number) => {
    coreRef.current?.seek(seconds);
  }, []);

  const next = useCallback(() => {
    coreRef.current?.next();
  }, []);

  const prev = useCallback(() => {
    coreRef.current?.prev();
  }, []);

  const setTrack = useCallback((index: number, autoPlay: boolean = true) => {
    coreRef.current?.setTrack(index, autoPlay);
  }, []);

  const setVolume = useCallback((level: number) => {
    coreRef.current?.setVolume(level);
  }, []);

  const setBass = useCallback((level: number) => {
    coreRef.current?.setBass(level);
  }, []);

  const setLoop = useCallback((mode: LoopMode) => {
    coreRef.current?.setLoop(mode);
  }, []);

  const toggleLoop = useCallback(() => {
    return coreRef.current?.toggleLoop();
  }, []);

  const setShuffle = useCallback((enabled: boolean) => {
    coreRef.current?.setShuffle(enabled);
  }, []);

  const toggleShuffle = useCallback(() => {
    return coreRef.current?.toggleShuffle();
  }, []);

  const setEqPreset = useCallback((preset: EqPreset) => {
    coreRef.current?.setEqPreset(preset);
  }, []);

  const setBandGain = useCallback((band: EqBand, gainDb: number) => {
    coreRef.current?.setBandGain(band, gainDb);
  }, []);

  const getAudioEnergy = useCallback((): AudioEnergy => {
    return coreRef.current?.getAudioEnergy() || { bass: 0, midHigh: 0, left: 0, right: 0 };
  }, []);

  return {
    core: coreRef.current,
    state,
    isPlaying: state.isPlaying,
    isLoading: state.isLoading,
    currentTrack: state.currentTrack,
    currentIndex: state.currentIndex,
    playlist: state.playlist,
    currentTime: state.currentTime,
    duration: state.duration,
    bufferedPercent: state.bufferedPercent,
    volume: state.volume,
    isMuted: state.isMuted,
    bass: state.bass,
    loopMode: state.loopMode,
    isShuffle: state.isShuffle,
    eqPreset: state.eqPreset,
    bandGains: state.bandGains,
    error: state.error,
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
