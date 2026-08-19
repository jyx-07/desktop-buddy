import type { AnimationDefinition, Direction, PetDefinition, PetState } from "../../types/pet";
import { createDefaultPetConfig } from "../../config/PetConfig";
import {
  PUPPY_DEFAULT_PERSONALITY,
  PUPPY_DISPLAY_BASE_HEIGHT,
  PUPPY_FPS_BY_STATE,
  PUPPY_FRAME_SIZE,
  PUPPY_STATES,
} from "./puppy.meta";

// Eagerly import every sliced sprite frame as a resolved URL (renderer/Vite only).
const frameModules = import.meta.glob<string>("./assets/**/*.png", {
  eager: true,
  query: "?url",
  import: "default",
});

/** Sorts "frame1.png".."frame12.png" numerically - plain string sort would
 * put "frame10.png" before "frame2.png" once a state grows past 9 frames. */
function byFrameNumber(a: string, b: string): number {
  const numA = Number(a.match(/(\d+)(?=\.png$)/)?.[1] ?? 0);
  const numB = Number(b.match(/(\d+)(?=\.png$)/)?.[1] ?? 0);
  return numA - numB;
}

/** assets/<state>/frame*.png - for states with no direction-dependence. */
function framesFor(state: PetState): string[] {
  return Object.keys(frameModules)
    .filter((key) => key.startsWith(`./assets/${state}/`) && !key.includes("/", `./assets/${state}/`.length))
    .sort(byFrameNumber)
    .map((key) => frameModules[key]);
}

/** 1,2,3..n,n-1..2 - plays a cycle forward then back instead of snapping
 * from the last frame straight to the first. */
function pingPong(frames: string[]): string[] {
  return [...frames, ...frames.slice(0, -1).reverse()];
}

const DIRECTIONS: Direction[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

/** assets/<state>/<direction>/frame*.png - each direction has its own real gait cycle. */
function framesByDirectionFor(state: "walk" | "run"): Partial<Record<Direction, string[]>> {
  const result: Partial<Record<Direction, string[]>> = {};
  for (const dir of DIRECTIONS) {
    const prefix = `./assets/${state}/${dir}/`;
    const frames = Object.keys(frameModules)
      .filter((key) => key.startsWith(prefix))
      .sort(byFrameNumber)
      .map((key) => frameModules[key]);
    if (frames.length) result[dir] = frames;
  }
  return result;
}

const WALK_FRAMES_BY_DIRECTION = framesByDirectionFor("walk");
const RUN_FRAMES_BY_DIRECTION = framesByDirectionFor("run");

// East run art reuses the West cycle, mirrored at render time (see
// `mirrorByDirection` below) rather than keeping separately-authored art.
if (RUN_FRAMES_BY_DIRECTION.W) {
  RUN_FRAMES_BY_DIRECTION.E = RUN_FRAMES_BY_DIRECTION.W;
}

// States that don't have dedicated art yet reuse an existing pose - just a
// distinct entry in the state machine, not a real asset folder.
const REUSED_STATE_FRAMES: Partial<Record<PetState, PetState>> = {
  lookAtCursor: "idle",
  lookAround: "idle",
  petted: "happy",
  dragged: "surprised",
};

// Render-time size correction, applied on top of the sprite pixels rather
// than by editing them - some poses' source art simply reads visually
// smaller/larger than the rest at the same on-screen frame size.
const STATE_SCALE: Partial<Record<PetState, number>> = {
  idle: 0.96,
  wake: 0.96,
  happy: 1.15,
};

const animations: AnimationDefinition[] = PUPPY_STATES.map((name) => ({
  name,
  // Fall back to the east-facing cycle so an unexpected direction never
  // renders blank.
  frames:
    name === "walk"
      ? (WALK_FRAMES_BY_DIRECTION.E ?? [])
      : name === "run"
        ? (RUN_FRAMES_BY_DIRECTION.E ?? [])
        : name === "play"
          ? pingPong(framesFor(name))
          : framesFor(name),
  fps: PUPPY_FPS_BY_STATE[name],
  loop: name !== "surprised",
  ...(STATE_SCALE[name] !== undefined ? { scale: STATE_SCALE[name] } : {}),
  ...(name === "walk"
    ? {
        framesByDirection: WALK_FRAMES_BY_DIRECTION,
        // Walking west was extracted at a visibly smaller scale than every
        // other direction - bring it back in line with the rest of the cycle.
        scaleByDirection: { W: 1.21 },
      }
    : {}),
  ...(name === "run"
    ? {
        framesByDirection: RUN_FRAMES_BY_DIRECTION,
        mirrorByDirection: { E: true },
      }
    : {}),
}));

for (const [state, reuseFrom] of Object.entries(REUSED_STATE_FRAMES) as [PetState, PetState][]) {
  const scale = STATE_SCALE[reuseFrom];
  animations.push({
    name: state,
    frames: framesFor(reuseFrom),
    fps: 1,
    loop: true,
    ...(scale !== undefined ? { scale } : {}),
  });
}

// PetConfig.ts's createDefaultPetConfig() is the one source of truth for
// default settings - reuse it here instead of maintaining a second,
// silently-divergent copy of the same defaults.
const { personality: _personality, petId: _petId, name: _name, ...defaultConfigRest } = createDefaultPetConfig();

export const PUPPY_DEFINITION: PetDefinition = {
  id: "puppy",
  displayName: "강아지",
  animations,
  frameSize: PUPPY_FRAME_SIZE,
  displayBaseHeight: PUPPY_DISPLAY_BASE_HEIGHT,
  defaultPersonality: PUPPY_DEFAULT_PERSONALITY,
  defaultConfig: defaultConfigRest,
};
