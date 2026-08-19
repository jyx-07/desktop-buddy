import type { BehaviorController } from "./BehaviorController";
import type { SpeechController } from "./SpeechController";
import type { PetConfig, PetState } from "../types/pet";

const CURSOR_IDLE_LOOK_THRESHOLD_MS = 10000;
const LOOK_COOLDOWN_MS = 15000;
const MAX_SPEECH_DURATION_MS = 4000;

interface ClickReaction {
  state: PetState;
  weight: number;
  durationMs: number;
}

// Short speech-bubble lines per reaction state - picked at random so the
// same click doesn't always say the same thing.
const REACTION_PHRASES: Partial<Record<PetState, string[]>> = {
  surprised: ["앗!", "깜짝이야!", "엥?!"],
  happy: ["좋아!", "히히", "신난다!"],
  petted: ["음~ 좋다", "더 만져줘", "기분 좋아"],
  lookAround: ["음?", "뭐지?"],
  play: ["같이 놀자!", "놀자!", "재밌다!"],
};

function pickPhrase(state: PetState): string | undefined {
  const pool = REACTION_PHRASES[state];
  if (!pool || pool.length === 0) return undefined;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** "How does the pet respond to the user" - clicks, petting, dragging, cursor attention. */
export class InteractionController {
  private config: PetConfig;
  private behavior: BehaviorController;
  private speech: SpeechController;
  private lastCursor: { x: number; y: number } | null = null;
  private lastCursorMoveAt = 0;
  private lastLookAt = -Infinity;
  private recentClickReactions: PetState[] = [];

  constructor(config: PetConfig, behavior: BehaviorController, speech: SpeechController) {
    this.config = config;
    this.behavior = behavior;
    this.speech = speech;
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
      { state: "lookAround", weight: 10, durationMs: 1500 },
      { state: "play", weight: 10 + playfulness * 15, durationMs: 12000 }, // several loops of the play animation cycle
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
    const phrase = pickPhrase(chosen.state);
    // Say it for a quick beat, not the reaction's full duration - a bubble
    // shouldn't sit on screen for the entire ~12s play session.
    if (phrase) this.speech.say(phrase, Math.min(chosen.durationMs, MAX_SPEECH_DURATION_MS));
    setTimeout(() => this.behavior.forceState("idle", 400), chosen.durationMs);
  }

  /** Called when the user drops the pet after dragging it. */
  handleDragEnd() {
    const { playfulness, energy } = this.config.personality;
    const goesHappy = Math.random() < playfulness * 0.5;

    if (goesHappy) {
      this.behavior.forceState("happy", 900);
      const phrase = pickPhrase("happy");
      if (phrase) this.speech.say(phrase, 900);
      setTimeout(() => this.behavior.forceState("idle", 300 + energy * 400), 900);
    } else {
      this.behavior.forceState("surprised", 500);
      const phrase = pickPhrase("surprised");
      if (phrase) this.speech.say(phrase, 500);
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
    // Only steal a glance while the pet is otherwise doing nothing - forcing
    // this mid-sleep (or mid-walk/run/play) cut those states short and read
    // as "lies down, then instantly pops back up."
    if (this.behavior.getState() !== "idle") return;
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
