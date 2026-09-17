import { HoregAudio } from './Player';
import { HoregPlayerOptions } from './types';

/**
 * Creates a React component wrapper for HoregAudio.
 *
 * @example
 * ```tsx
 * import React from 'react';
 * import { createReactPlayer } from 'horeg-audio';
 *
 * const HoregPlayer = createReactPlayer(React);
 *
 * function App() {
 *   return <HoregPlayer playlist={myTracks} visualizerMode="canvas" eqPreset="horeg-sub-punch" />;
 * }
 * ```
 */
export function createReactPlayer(React: any) {
  return function HoregAudioPlayer(props: HoregPlayerOptions & { className?: string; style?: any; onReady?: (player: HoregAudio) => void }) {
    const containerRef = React.useRef(null);
    const playerRef = React.useRef(null);

    React.useEffect(() => {
      if (!containerRef.current) return;
      const { className, style, onReady, ...options } = props;
      const player = new HoregAudio({
        ...options,
        container: containerRef.current
      });
      playerRef.current = player;
      if (onReady) onReady(player);

      return () => {
        player.destroy();
        playerRef.current = null;
      };
    }, []);

    return React.createElement('div', {
      ref: containerRef,
      className: props.className,
      style: { width: '100%', ...(props.style || {}) }
    });
  };
}

/**
 * Creates a Vue 3 component definition wrapper for HoregAudio.
 *
 * @example
 * ```ts
 * import * as Vue from 'vue';
 * import { createVuePlayer } from 'horeg-audio';
 *
 * export default createVuePlayer(Vue);
 * ```
 */
export function createVuePlayer(Vue: any) {
  return Vue.defineComponent({
    name: 'HoregAudioPlayer',
    props: {
      options: {
        type: Object,
        default: () => ({})
      }
    },
    setup(props: any, { emit }: any) {
      const container = Vue.ref(null);
      let player: HoregAudio | null = null;

      Vue.onMounted(() => {
        if (!container.value) return;
        player = new HoregAudio({
          ...props.options,
          container: container.value
        });
        emit('ready', player);
      });

      Vue.onBeforeUnmount(() => {
        if (player) {
          player.destroy();
          player = null;
        }
      });

      return () => Vue.h('div', { ref: container, style: { width: '100%' } });
    }
  });
}
