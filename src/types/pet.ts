// Core data model shared between main and renderer processes.
// Keep this file framework-free (no Electron / React imports) so it can be
// imported from both the Node (main) and browser (renderer) worlds.

export type PetState =
  | "idle"
  | "walk"
  | "run"
  | "sit"
  | "sleep"
  | "wake"
  | "happy"
  | "surprised"
  | "lookAtCursor"
  | "lookAround"
  | "play"
  | "petted"
  | "dragged";

/** 8-directional facing, matching the compass on the reference sheet. */
export type Direction = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

export interface AnimationDefinition {
  name: PetState;
  /** Frame image paths, relative to the pet's asset root, in playback order. */
  frames: string[];
  /** Optional per-direction override (used by walk/run) - falls back to `frames` when absent for the current direction. */
  framesByDirection?: Partial<Record<Direction, string[]>>;
  fps: number;
  loop: boolean;
  /** Render-time size correction (1 = as-authored) - lets poses whose source
   * art reads visually smaller/larger than the rest be normalized without
   * touching the sprite pixels themselves. */
  scale?: number;
  /** Per-direction override of `scale`, for states (walk/run) whose gait
   * cycle was extracted at an inconsistent scale between directions. */
  scaleByDirection?: Partial<Record<Direction, number>>;
  /** Directions whose frames should render horizontally mirrored - e.g. an
   * east-facing cycle that's really just the west-facing art flipped,
   * reusing one authored gait cycle for both directions. */
  mirrorByDirection?: Partial<Record<Direction, boolean>>;
  /** Per-frame horizontal nudge, as a percent of the sprite canvas width
   * (matches this state's `frames` array index-for-index) - corrects source
   * art whose subject isn't centered consistently frame to frame (e.g. a
   * swinging tail dragging the whole bounding box off-center) without
   * touching the sprite pixels themselves. */
  offsetXByFrame?: number[];
}

/**
 * Internal personality sliders (0-1). Never shown to the user as raw numbers -
 * the Settings UI maps these to labeled sliders (e.g. "조용함 <-> 활발함").
 */
export interface Personality {
  energy: number;
  friendliness: number;
  curiosity: number;
  sleepiness: number;
  playfulness: number;
}

export interface BehaviorConfig {
  walking: boolean;
  running: boolean;
  sitting: boolean;
  sleeping: boolean;
  yawning: boolean;
  lookAtCursor: boolean;
  followCursor: boolean;
  suddenDash: boolean;
  cursorInteraction: boolean;
  dragging: boolean;
}

/** WHEN/DO automation rule. UI can stay minimal for now; the shape is what matters. */
export type RuleTrigger =
  | { type: "idleForMinutes"; minutes: number }
  | { type: "timeOfDay"; hour: number; minute: number }
  | { type: "mouseIdleSeconds"; seconds: number };

export type RuleAction =
  | { type: "moveNear" }
  | { type: "sleep" }
  | { type: "lookAtCursor" }
  | { type: "playAnimation"; state: PetState };

export interface BehaviorRule {
  id: string;
  enabled: boolean;
  trigger: RuleTrigger;
  action: RuleAction;
}

export interface PetConfig {
  petId: string;
  name: string;

  appearance: {
    type: string;
  };

  position: {
    x: number;
    y: number;
  };

  personality: Personality;
  behavior: BehaviorConfig;

  /** 0 (quiet) - 1 (very active): controls how often the pet initiates activity. */
  activityLevel: number;
  moveSpeed: number;

  rules: BehaviorRule[];
}

/** Static definition of a pet species/character - not user editable. */
export interface PetDefinition {
  id: string;
  displayName: string;
  animations: AnimationDefinition[];
  defaultPersonality: Personality;
  defaultConfig: Omit<PetConfig, "personality" | "petId" | "name"> & {
    petId?: string;
  };
  /** Native pixel size of one animation frame at scale = 1. */
  frameSize: { width: number; height: number };
  /** On-screen height (px) at scale = 1 - the asset canvas isn't native 1x
   * pixel-art resolution, so display size scales off this instead of frameSize. */
  displayBaseHeight: number;
}

/** The pet's real on-screen size - shared by window sizing (main process) and
 * movement bounds (engine), so the walkable area always matches the actual
 * window instead of the raw asset canvas dimensions. Fixed, not user-adjustable. */
export function computeDisplaySize(
  definition: Pick<PetDefinition, "frameSize" | "displayBaseHeight">,
): { width: number; height: number } {
  const height = Math.round(definition.displayBaseHeight);
  const width = Math.round(height * (definition.frameSize.width / definition.frameSize.height));
  return { width, height };
}
