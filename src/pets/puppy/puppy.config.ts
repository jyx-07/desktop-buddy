import type { AnimationDefinition, Direction, PetDefinition, PetState } from "../../types/pet";
import {
  PUPPY_DEFAULT_PERSONALITY,
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

/** assets/<state>/frame*.png - for states with no direction-dependence. */
function framesFor(state: PetState): string[] {
  return Object.keys(frameModules)
    .filter((key) => key.startsWith(`./assets/${state}/`) && !key.includes("/", `./assets/${state}/`.length))
    .sort()
    .map((key) => frameModules[key]);
}

const DIRECTIONS: Direction[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

/** assets/<state>/<direction>/frame*.png - each direction has its own real gait cycle. */
function framesByDirectionFor(state: "walk" | "run"): Partial<Record<Direction, string[]>> {
  const result: Partial<Record<Direction, string[]>> = {};
  for (const dir of DIRECTIONS) {
    const prefix = `./assets/${state}/${dir}/`;
    const frames = Object.keys(frameModules)
      .filter((key) => key.startsWith(prefix))
      .sort()
      .map((key) => frameModules[key]);
    if (frames.length) result[dir] = frames;
  }
  return result;
}

const WALK_FRAMES_BY_DIRECTION = framesByDirectionFor("walk");
const RUN_FRAMES_BY_DIRECTION = framesByDirectionFor("run");

const animations: AnimationDefinition[] = PUPPY_STATES.map((name) => ({
  name,
  // Fall back to the east-facing cycle so an unexpected direction never
  // renders blank.
  frames: name === "walk" ? (WALK_FRAMES_BY_DIRECTION.E ?? []) : name === "run" ? (RUN_FRAMES_BY_DIRECTION.E ?? []) : framesFor(name),
  fps: PUPPY_FPS_BY_STATE[name],
  loop: name !== "surprised",
  ...(name === "walk" ? { framesByDirection: WALK_FRAMES_BY_DIRECTION } : {}),
  ...(name === "run" ? { framesByDirection: RUN_FRAMES_BY_DIRECTION } : {}),
}));

// A few behavioral states reuse an existing pose - they don't need dedicated
// art yet, just a distinct entry in the state machine.
animations.push(
  { name: "wake", frames: framesFor("sit"), fps: 1, loop: true },
  { name: "lookAtCursor", frames: framesFor("sit"), fps: 1, loop: true },
  { name: "lookAround", frames: framesFor("sit"), fps: 1, loop: true },
  { name: "petted", frames: framesFor("happy"), fps: 1, loop: true },
  { name: "dragged", frames: framesFor("surprised"), fps: 1, loop: true },
);

export const PUPPY_DEFINITION: PetDefinition = {
  id: "puppy",
  displayName: "강아지",
  animations,
  frameSize: PUPPY_FRAME_SIZE,
  defaultPersonality: PUPPY_DEFAULT_PERSONALITY,
  defaultConfig: {
    appearance: { type: "puppy", scale: 1 },
    position: { x: 200, y: 200 },
    behavior: {
      walking: true,
      running: true,
      sitting: true,
      sleeping: true,
      yawning: true,
      lookAtCursor: true,
      followCursor: false,
      suddenDash: true,
      cursorInteraction: true,
      dragging: true,
    },
    activityLevel: 0.5,
    moveSpeed: 1,
    rules: [],
  },
};
