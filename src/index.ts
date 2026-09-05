import { HoregAudio } from './Player';

// Attach self references for seamless interop across ESM, CJS, and browser globals
(HoregAudio as any).HoregAudio = HoregAudio;
(HoregAudio as any).default = HoregAudio;

export * from './types';
export { HoregAudio };
export default HoregAudio;

