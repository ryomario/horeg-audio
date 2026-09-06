import { HoregAudio } from './Player';
import { THEME_PRESETS, generateStyles } from './styles';

// Attach self references for seamless interop across ESM, CJS, and browser globals
(HoregAudio as any).HoregAudio = HoregAudio;
(HoregAudio as any).default = HoregAudio;
(HoregAudio as any).THEME_PRESETS = THEME_PRESETS;
(HoregAudio as any).generateStyles = generateStyles;

export * from './types';
export { HoregAudio, THEME_PRESETS, generateStyles };
export default HoregAudio;

