import type { PetConfig, PetState } from "../types/pet";

interface Decision {
  state: PetState;
  durationMs: number;
}

type Listener = (state: PetState) => void;

const FALLBACK_DECISION_MS = 2500;
const POST_ARRIVAL_PAUSE_MS = 250;
const PRE_SLEEP_SETTLE_MS = 900;
const WAKE_BEAT_MS = 1200;
const ACTION_GAP_MS = 1500;

/** "What should the pet be doing right now" - a lightweight weighted state machine. */
export class BehaviorController {
  private config: PetConfig;
  private current: PetState = "idle";
  private remainingMs = 0;
  private forced = false;
  private listeners = new Set<Listener>();
  /** A queued next step for multi-beat transitions (sit -> sleep, sleep -> wake -> decide),
   * run entirely off the normal tick clock instead of setTimeout/real-time,
   * so it can never race the update() loop or fire twice. */
  private pendingChain: (() => void) | null = null;

  constructor(config: PetConfig) {
    this.config = config;
  }

  updateConfig(config: PetConfig) {
    this.config = config;
  }

  getState(): PetState {
    return this.current;
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setState(state: PetState, durationMs: number, forced = false) {
    this.forced = forced;
    this.remainingMs = durationMs;
    if (state !== this.current) {
      this.current = state;
      for (const listener of this.listeners) listener(state);
    }
  }

  /** Interactions & automation rules temporarily override the natural state machine. */
  forceState(state: PetState, durationMs: number) {
    this.pendingChain = null;
    this.setState(state, durationMs, true);
  }

  /** Called every tick with whether MovementEngine is still travelling - lets
   * a walk/run wrap up as soon as the pet actually arrives, instead of
   * standing still (mid-"walk" animation) until an arbitrary timer expires. */
  notifyMovementMoving(isMoving: boolean) {
    if (this.forced || isMoving) return;
    if (this.current === "walk" || this.current === "run") {
      this.remainingMs = Math.min(this.remainingMs, POST_ARRIVAL_PAUSE_MS);
    }
  }

  update(dtMs: number) {
    this.remainingMs -= dtMs;
    if (this.remainingMs > 0) return;

    if (this.pendingChain) {
      const next = this.pendingChain;
      this.pendingChain = null;
      next();
      return;
    }

    if (this.forced) this.forced = false;

    if (this.current === "sleep") {
      // Woke up naturally - a brief beat before resuming normal behavior,
      // instead of snapping straight from curled-up-asleep to walking.
      if (this.config.behavior.yawning) {
        this.setState("wake", WAKE_BEAT_MS, true);
        this.pendingChain = () => this.rollNextBehavior();
        return;
      }
    }

    if (this.current !== "idle") {
      // Breathing room between one burst of activity and the next, instead
      // of chaining straight from one action (play, lookAround, ...) into
      // another back-to-back.
      this.setState("idle", ACTION_GAP_MS, true);
      this.pendingChain = () => this.rollNextBehavior();
      return;
    }

    this.rollNextBehavior();
  }

  private rollNextBehavior() {
    const decision = this.decideNext();
    if (decision.state === "sleep") {
      // Settle first - going from mid-stride straight into a curled-up sleep
      // pose reads as a glitch, not "getting sleepy."
      this.setState("idle", PRE_SLEEP_SETTLE_MS, true);
      this.pendingChain = () => this.setState("sleep", decision.durationMs);
      return;
    }
    this.setState(decision.state, decision.durationMs);
  }

  private decideNext(): Decision {
    const { personality, behavior, activityLevel } = this.config;

    const options: Array<{ state: PetState; weight: number; duration: [number, number] }> = [
      { state: "idle", weight: 3, duration: [2000, 5000] },
      { state: "lookAround", weight: 1 + personality.curiosity * 2, duration: [1000, 2200] },
    ];

    if (behavior.walking) {
      options.push({
        state: "walk",
        weight: 2 + activityLevel * 4 + personality.curiosity * 2,
        duration: [4000, 12000], // upper bound is a safety cap - arrival ends it sooner
      });
    }
    if (behavior.running) {
      options.push({
        state: "run",
        weight: behavior.suddenDash ? personality.energy * personality.playfulness * 4 : 0.2,
        duration: [2000, 5000],
      });
    }
    if (behavior.sitting) {
      options.push({
        state: "sit",
        weight: 2 + (1 - activityLevel) * 2,
        duration: [3000, 6000],
      });
    }
    if (behavior.sleeping) {
      options.push({
        state: "sleep",
        weight: personality.sleepiness * 5,
        duration: [900000, 1200000], // a proper long nap (15-20 min) - only a mouse click/drag should cut it short
      });
    }
    if (personality.playfulness > 0.5) {
      options.push({
        state: "play",
        weight: personality.playfulness * personality.energy * 2,
        duration: [10000, 14000], // several loops of the ~4s play animation cycle (1..6..1)
      });
    }

    const totalWeight = options.reduce((sum, o) => sum + Math.max(o.weight, 0), 0);
    let roll = Math.random() * totalWeight;
    for (const option of options) {
      roll -= Math.max(option.weight, 0);
      if (roll <= 0) {
        const [min, max] = option.duration;
        return { state: option.state, durationMs: min + Math.random() * (max - min) };
      }
    }
    return { state: "idle", durationMs: FALLBACK_DECISION_MS };
  }
}
