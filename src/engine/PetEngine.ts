import type { WorkArea } from "../shared/ipc";
import type { Direction, PetConfig, PetDefinition, PetState } from "../types/pet";
import { computeDisplaySize } from "../types/pet";
import { AnimationPlayer } from "./AnimationPlayer";
import { BehaviorController } from "./BehaviorController";
import { directionFromVector, MovementEngine } from "./MovementEngine";
import { InteractionController } from "./InteractionController";
import { RuleEngine } from "./RuleEngine";
import { DragController } from "./DragController";
import { SpeechController } from "./SpeechController";

// Speech lines for behavior states the pet enters on its own (not from a
// click/drag reaction, which pick their own line in InteractionController) -
// rolled at a chance each time so the pet doesn't narrate every single move.
const AUTONOMOUS_PHRASES: Partial<Record<PetState, string[]>> = {
  wake: ["잘 잤다~", "몸이 개운해!"],
  play: ["심심해!", "놀고 싶다~"],
  lookAround: ["음?", "뭐지?", "어디 갔지?"],
  run: ["신난다!", "가자가자!"],
  sleep: ["졸려... zzz", "잠깐 잘게"],
};
const AUTONOMOUS_SPEECH_CHANCE = 0.35;
const AUTONOMOUS_SPEECH_DURATION_MS = 2000;

export interface PetSnapshot {
  x: number;
  y: number;
  facing: Direction;
  /** Last non-ambiguous horizontal heading - used to mirror the single-pose
   * states (sleep, sit, ...) that don't have their own 8-direction art. */
  horizontalBias: "left" | "right";
  frameSrc: string | undefined;
  state: PetState;
  isDragging: boolean;
  /** Render-time size correction for the current pose (1 = none). */
  scale: number;
  /** Current speech-bubble text, or null when the pet isn't saying anything. */
  speechText: string | null;
}

/**
 * Composition root for a single living pet instance. React never touches
 * BehaviorController/MovementEngine/AnimationPlayer directly - it only calls
 * update() once per animation frame and reads the returned snapshot.
 */
export class PetEngine {
  private animation: AnimationPlayer;
  private movement: MovementEngine;
  private behavior: BehaviorController;
  private interaction: InteractionController;
  private rules: RuleEngine;
  private drag = new DragController();
  private speech = new SpeechController();
  private paused = false;
  private draggingEnabled = true;

  constructor(definition: PetDefinition, config: PetConfig, bounds: WorkArea) {
    this.animation = new AnimationPlayer(definition.animations, "idle");
    const displaySize = computeDisplaySize(definition);
    // Spawn grounded, matching exactly how createPetWindow.ts places the
    // window itself - otherwise the first tick's position report snaps the
    // window from the floor up to config.position's raw (x, y) on launch.
    const initialPosition = {
      x: config.position.x,
      y: bounds.y + bounds.height - displaySize.height,
    };
    this.movement = new MovementEngine(initialPosition, bounds, displaySize);
    this.movement.setSpeedMultiplier(config.moveSpeed);
    this.behavior = new BehaviorController(config);
    this.interaction = new InteractionController(config, this.behavior, this.speech);
    this.rules = new RuleEngine(config, this.behavior, this.movement);
    this.draggingEnabled = config.behavior.dragging;

    this.behavior.onChange((state) => this.applyBehaviorState(state));
  }

  private applyBehaviorState(state: PetState) {
    this.animation.play(state);
    this.maybeSayAutonomousLine(state);
    switch (state) {
      case "walk":
        this.movement.wanderWalk();
        break;
      case "run":
        this.movement.wanderRun();
        break;
      case "dragged":
        break; // position is driven directly by pointer events, not autonomous movement
      default:
        this.movement.stop();
    }
  }

  private maybeSayAutonomousLine(state: PetState) {
    const pool = AUTONOMOUS_PHRASES[state];
    if (!pool || pool.length === 0) return;
    if (Math.random() >= AUTONOMOUS_SPEECH_CHANCE) return;
    const phrase = pool[Math.floor(Math.random() * pool.length)];
    this.speech.say(phrase, AUTONOMOUS_SPEECH_DURATION_MS);
  }

  setConfig(config: PetConfig) {
    this.behavior.updateConfig(config);
    this.interaction.updateConfig(config);
    this.rules.updateConfig(config);
    this.movement.setSpeedMultiplier(config.moveSpeed);
    this.draggingEnabled = config.behavior.dragging;
  }

  setBounds(bounds: WorkArea) {
    this.movement.setBounds(bounds);
  }

  setPaused(paused: boolean) {
    this.paused = paused;
  }

  handleClick() {
    if (this.paused) return;
    this.interaction.handleClick();
  }

  // --- Drag gesture entry points, called from PetRenderer's pointer handlers ---

  handlePointerDown(screenX: number, screenY: number) {
    if (!this.draggingEnabled || this.paused) return;
    const pos = this.movement.getPosition();
    this.drag.pointerDown(screenX, screenY, pos.x, pos.y);
  }

  /** @returns the new window position to apply immediately (skip waiting for
   * the next animation frame so dragging never feels a beat behind the cursor) */
  handlePointerMove(screenX: number, screenY: number): { x: number; y: number } | undefined {
    if (!this.draggingEnabled || this.paused) return undefined;
    const result = this.drag.pointerMove(screenX, screenY);
    if (result.type !== "drag-move") return undefined;

    if (this.behavior.getState() !== "dragged") {
      this.behavior.forceState("dragged", Number.MAX_SAFE_INTEGER);
    }

    const dist = Math.hypot(result.dx, result.dy);
    const facing = dist > 1.5 ? directionFromVector(result.dx, result.dy) : undefined;
    this.movement.setPositionImmediate(result.windowX, result.windowY, facing);
    return this.movement.getPosition();
  }

  /** @returns true if this pointer-up ended a drag (vs. a plain click) */
  handlePointerUp(): boolean {
    const result = this.drag.pointerUp();
    if (this.paused) return false;
    if (result.type === "click") {
      this.interaction.handleClick();
      return false;
    }
    if (result.type === "drag-end") {
      this.interaction.handleDragEnd();
      return true;
    }
    return false;
  }

  get isDragging(): boolean {
    return this.drag.isDragging;
  }

  applySystemTick(cursor: { x: number; y: number }, idleSeconds: number, now: { hour: number; minute: number }) {
    const nowMs = performance.now();
    this.interaction.handleCursorTick(cursor, nowMs);
    this.rules.evaluate({ cursor, idleSeconds, timeOfDay: now });
  }

  update(dtMs: number): PetSnapshot {
    this.speech.update(dtMs);

    if (this.drag.isDragging) {
      const pos = this.movement.getPosition();
      const facing = this.movement.getFacing();
      this.animation.setDirection(facing);
      this.animation.update(dtMs);
      return {
        x: pos.x,
        y: pos.y,
        facing,
        horizontalBias: this.movement.getHorizontalBias(),
        frameSrc: this.animation.getCurrentFrameSrc(),
        state: this.animation.state,
        isDragging: true,
        scale: this.animation.getCurrentScale(),
        speechText: this.speech.current,
      };
    }

    if (!this.paused) {
      this.behavior.update(dtMs);
      const moveResult = this.movement.update(dtMs);
      this.behavior.notifyMovementMoving(moveResult.isMoving);
      this.animation.setDirection(moveResult.facing);
      this.animation.update(dtMs);
      return {
        x: moveResult.x,
        y: moveResult.y,
        facing: moveResult.facing,
        horizontalBias: this.movement.getHorizontalBias(),
        frameSrc: this.animation.getCurrentFrameSrc(),
        state: this.animation.state,
        isDragging: false,
        scale: this.animation.getCurrentScale(),
        speechText: this.speech.current,
      };
    }

    const pos = this.movement.getPosition();
    return {
      x: pos.x,
      y: pos.y,
      facing: this.movement.getFacing(),
      horizontalBias: this.movement.getHorizontalBias(),
      frameSrc: this.animation.getCurrentFrameSrc(),
      state: this.animation.state,
      isDragging: false,
      scale: this.animation.getCurrentScale(),
      speechText: this.speech.current,
    };
  }
}
