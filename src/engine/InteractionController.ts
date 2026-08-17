import type { BehaviorController } from "./BehaviorController";
import type { PetConfig, PetState } from "../types/pet";

const CURSOR_IDLE_LOOK_THRESHOLD_MS = 10000;
const LOOK_COOLDOWN_MS = 15000;

interface ClickReaction {
  state: PetState;
  weight: number;
  durationMs: number;
}

/** "How does the pet respond to the user" - clicks, petting, dragging, cursor attention. */
export class InteractionController {
  private config: PetConfig;
  private behavior: BehaviorController;
  private lastCursor: { x: number; y: number } | null = null;
  private lastCursorMoveAt = 0;
  private lastLookAt = -Infinity;
  private recentClickReactions: PetState[] = [];

  constructor(config: PetConfig, behavior: BehaviorController) {
    this.config = config;
    this.behavior = behavior;
  }

  updateConfig(config: PetConfig) {
    this.config = config;
  }

  /** Click reactions are varied and personality-weighted, and avoid repeating
   * the same reaction twice in a row so clicking doesn't feel like a button. */
  handleClick() {
    if (!this.config.behavior.cursorInteraction) return;
    const { friendliness, playfulness } = this.config.personality;

    const allReactions: ClickReaction[] = [
      { state: "surprised", weight: 20, durationMs: 500 },
      { state: "happy", weight: 15 + friendliness * 10, durationMs: 1200 },
      { state: "petted", weight: 15 + friendliness * 15, durationMs: 1400 },
      { state: "sit", weight: 15, durationMs: 2000 },
      { state: "lookAround", weight: 10, durationMs: 1500 },
      { state: "play", weight: 10 + playfulness * 15, durationMs: 1800 },
    ];
    const unrepeated = allReactions.filter((r) => !this.recentClickReactions.includes(r.state));
    // If every reaction was recently used (small reaction pool), fall back to
    // the full list rather than reacting with nothing.
    const reactions = unrepeated.length > 0 ? unrepeated : allReactions;

    const total = reactions.reduce((sum, r) => sum + r.weight, 0);
    let roll = Math.random() * total;
    let chosen = reactions[0];
    for (const r of reactions) {
      roll -= r.weight;
      if (roll <= 0) {
        chosen = r;
        break;
      }
    }

    this.recentClickReactions.push(chosen.state);
    if (this.recentClickReactions.length > 2) this.recentClickReactions.shift();

    this.behavior.forceState(chosen.state, chosen.durationMs);
    setTimeout(() => this.behavior.forceState("idle", 400), chosen.durationMs);
  }

  /** Called when the user drops the pet after dragging it. */
  handleDragEnd() {
    const { playfulness, energy } = this.config.personality;
    const goesHappy = Math.random() < playfulness * 0.5;

    if (goesHappy) {
      this.behavior.forceState("happy", 900);
      setTimeout(() => this.behavior.forceState("idle", 300 + energy * 400), 900);
    } else {
      this.behavior.forceState("surprised", 500);
      setTimeout(() => this.behavior.forceState("lookAround", 1200), 500);
      setTimeout(() => this.behavior.forceState("idle", 300), 1700);
    }
  }

  /** Feed this every system tick broadcast from the main process. */
  handleCursorTick(cursor: { x: number; y: number }, nowMs: number) {
    if (!this.lastCursor || this.lastCursor.x !== cursor.x || this.lastCursor.y !== cursor.y) {
      this.lastCursor = cursor;
      this.lastCursorMoveAt = nowMs;
      return;
    }

    if (!this.config.behavior.lookAtCursor) return;
    const idleMs = nowMs - this.lastCursorMoveAt;
    const cooldownOk = nowMs - this.lastLookAt > LOOK_COOLDOWN_MS;
    if (idleMs > CURSOR_IDLE_LOOK_THRESHOLD_MS && cooldownOk) {
      // Curious pets notice a resting cursor more often - not on every tick,
      // so the behavior reads as "occasionally glances over" not "always stares."
      if (Math.random() < this.config.personality.curiosity * 0.05) {
        this.lastLookAt = nowMs;
        this.behavior.forceState("lookAtCursor", 2000);
      }
    }
  }
}
