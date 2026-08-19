import type { AnimationDefinition, Direction, PetState } from "../types/pet";

/** "Which frame should be on screen right now" - nothing else. */
export class AnimationPlayer {
  private definitions: Map<PetState, AnimationDefinition>;
  private current: PetState;
  private direction: Direction = "S";
  private frameIndex = 0;
  private elapsedMs = 0;
  private finished = false;

  constructor(animations: AnimationDefinition[], initial: PetState = "idle") {
    this.definitions = new Map(animations.map((a) => [a.name, a]));
    this.current = initial;
  }

  play(state: PetState) {
    if (this.current === state) return;
    this.current = state;
    this.frameIndex = 0;
    this.elapsedMs = 0;
    this.finished = false;
  }

  /** Movement direction context - only affects states with a framesByDirection map (walk/run). */
  setDirection(direction: Direction) {
    this.direction = direction;
  }

  get state(): PetState {
    return this.current;
  }

  get facing(): Direction {
    return this.direction;
  }

  /** True once a non-looping animation has played through its last frame. */
  get isFinished(): boolean {
    return this.finished;
  }

  /** Render-time size correction for the current state/direction (1 = none). */
  getCurrentScale(): number {
    const def = this.definitions.get(this.current);
    if (!def) return 1;
    return def.scaleByDirection?.[this.direction] ?? def.scale ?? 1;
  }

  private activeFrames(def: AnimationDefinition): string[] {
    return def.framesByDirection?.[this.direction] ?? def.frames;
  }

  update(dtMs: number) {
    const def = this.definitions.get(this.current);
    if (!def) return;
    const frames = this.activeFrames(def);
    if (frames.length <= 1) return;

    this.elapsedMs += dtMs;
    const frameDurationMs = 1000 / def.fps;
    while (this.elapsedMs >= frameDurationMs) {
      this.elapsedMs -= frameDurationMs;
      const next = this.frameIndex + 1;
      if (next >= frames.length) {
        if (def.loop) {
          this.frameIndex = 0;
        } else {
          this.finished = true;
        }
      } else {
        this.frameIndex = next;
      }
    }
  }

  getCurrentFrameSrc(): string | undefined {
    const def = this.definitions.get(this.current);
    if (!def) return undefined;
    const frames = this.activeFrames(def);
    return frames[this.frameIndex] ?? frames[0];
  }
}
