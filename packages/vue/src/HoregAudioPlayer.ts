import { defineComponent, ref, onMounted, onUnmounted, watch, h, type PropType } from 'vue';
import { HoregAudio } from '../../../src/Player';
import { HoregTheme, VisualizerMode, Track } from '../../../src/types';

export const HoregAudioPlayer = defineComponent({
  name: 'HoregAudioPlayer',
  props: {
    playlist: {
      type: Array as PropType<Track[]>,
      default: () => []
    },
    theme: {
      type: Object as PropType<Partial<HoregTheme>>,
      default: undefined
    },
    bassBoost: {
      type: Number,
      default: 0
    },
    volume: {
      type: Number,
      default: 0.8
    },
    visualizerMode: {
      type: String as PropType<VisualizerMode>,
      default: 'dom'
    },
    autoplay: {
      type: Boolean,
      default: false
    }
  },
  emits: ['ready', 'play', 'pause', 'trackChange', 'ended', 'timeUpdate', 'bassChange'],
  setup(props, { emit, expose }) {
    const containerRef = ref<HTMLElement | null>(null);
    let playerInstance: HoregAudio | null = null;

    onMounted(() => {
      if (!containerRef.value) return;

      playerInstance = new HoregAudio({
        container: containerRef.value,
        playlist: props.playlist,
        theme: props.theme,
        bassBoost: props.bassBoost,
        volume: props.volume,
        visualizerMode: props.visualizerMode,
        autoplay: props.autoplay,
        onPlay: (track) => emit('play', track),
        onPause: () => emit('pause'),
        onTrackChange: (track, index) => emit('trackChange', { track, index }),
        onEnded: (track) => emit('ended', track),
        onTimeUpdate: (cur, dur) => emit('timeUpdate', { currentTime: cur, duration: dur }),
        onBassChange: (bass) => emit('bassChange', bass)
      });

      emit('ready', playerInstance);
    });

    onUnmounted(() => {
      if (playerInstance) {
        playerInstance.destroy();
        playerInstance = null;
      }
    });

    watch(
      () => props.theme,
      (newTheme) => {
        if (playerInstance && newTheme) {
          playerInstance.setTheme(newTheme);
        }
      },
      { deep: true }
    );

    watch(
      () => props.bassBoost,
      (newBass) => {
        if (playerInstance && typeof newBass === 'number') {
          playerInstance.setBass(newBass);
        }
      }
    );

    watch(
      () => props.volume,
      (newVol) => {
        if (playerInstance && typeof newVol === 'number') {
          playerInstance.setVolume(newVol);
        }
      }
    );

    watch(
      () => props.visualizerMode,
      (newMode) => {
        if (playerInstance && newMode) {
          playerInstance.setVisualizerMode(newMode);
        }
      }
    );

    expose({
      getPlayer: () => playerInstance
    });

    return () =>
      h('div', {
        ref: containerRef,
        style: { width: '100%', minHeight: '156px' }
      });
  }
});
