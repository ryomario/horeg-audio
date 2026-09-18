import React, { useEffect, useRef } from 'react';
import { HoregAudio } from '../../../src/Player';
import { HoregPlayerOptions } from '../../../src/types';

export interface HoregAudioPlayerProps extends Omit<HoregPlayerOptions, 'container'> {
  className?: string;
  style?: React.CSSProperties;
  onReady?: (player: HoregAudio) => void;
}

export const HoregAudioPlayer: React.FC<HoregAudioPlayerProps> = ({
  className,
  style,
  onReady,
  theme,
  playlist,
  bassBoost,
  visualizerMode,
  volume,
  ...restOptions
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<HoregAudio | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const player = new HoregAudio({
      container: containerRef.current,
      playlist,
      theme,
      bassBoost,
      visualizerMode,
      volume,
      ...restOptions
    });

    playerRef.current = player;
    if (onReady) {
      onReady(player);
    }

    return () => {
      player.destroy();
      playerRef.current = null;
    };
  }, []);

  // Synchronize dynamic updates
  useEffect(() => {
    if (playerRef.current && theme) {
      playerRef.current.setTheme(theme);
    }
  }, [theme]);

  useEffect(() => {
    if (playerRef.current && bassBoost !== undefined) {
      playerRef.current.setBass(bassBoost);
    }
  }, [bassBoost]);

  useEffect(() => {
    if (playerRef.current && visualizerMode) {
      playerRef.current.setVisualizerMode(visualizerMode);
    }
  }, [visualizerMode]);

  useEffect(() => {
    if (playerRef.current && volume !== undefined) {
      playerRef.current.setVolume(volume);
    }
  }, [volume]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', minHeight: '156px', ...style }}
    />
  );
};
