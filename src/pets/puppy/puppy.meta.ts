// Framework-free pet metadata - safe to import from the Electron main
// process (plain Node/tsc, no Vite). Anything that needs `import.meta.glob`
// (the actual sprite frame URLs) lives in puppy.config.ts instead, which is
// renderer-only.
import type { PetState, Personality } from "../../types/pet";

// Shared canvas every sliced frame (poses + 8-direction sprites) was placed
// on, bottom-anchored - see scripts used to build src/pets/puppy/assets/.
export const PUPPY_FRAME_SIZE = { width: 323, height: 267 };

// The sliced sprite art isn't native 1x pixel-art grid resolution (it came
// from a raster reference sheet), so "scale" multiplies this display height
// rather than the raw asset pixel size - keeps the pet a believably small
// creature on screen instead of ballooning to hundreds of real pixels tall.
export const PUPPY_DISPLAY_BASE_HEIGHT = 110;

export const PUPPY_FPS_BY_STATE: Record<PetState, number> = {
  idle: 1,
  walk: 6,
  run: 10,
  sit: 1,
  sleep: 1,
  wake: 1,
  happy: 1,
  surprised: 1,
  lookAtCursor: 1,
  lookAround: 1,
  play: 1,
  petted: 1,
  dragged: 1,
};

export const PUPPY_STATES: PetState[] = [
  "idle",
  "walk",
  "run",
  "sit",
  "sleep",
  "wake",
  "happy",
  "surprised",
  "play",
];

export const PUPPY_DEFAULT_PERSONALITY: Personality = {
  energy: 0.5,
  friendliness: 0.6,
  curiosity: 0.5,
  sleepiness: 0.4,
  playfulness: 0.6,
};
