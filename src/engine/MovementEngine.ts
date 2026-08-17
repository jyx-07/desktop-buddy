import type { WorkArea } from "../shared/ipc";
import type { Direction } from "../types/pet";

interface MovementResult {
  x: number;
  y: number;
  facing: Direction;
  isMoving: boolean;
}

const BASE_WALK_SPEED = 55; // px/sec at speedMultiplier = 1
const BASE_RUN_SPEED = 170; // px/sec at speedMultiplier = 1
const ARRIVAL_THRESHOLD = 6; // px - close enough to the target to stop
const DECEL_RADIUS = 50; // px - starts easing speed down within this distance
const ACCEL_PER_SEC = 6; // how quickly velocity chases the desired velocity (higher = snappier)
const FACING_CHANGE_COOLDOWN_MS = 120; // avoids flickering between adjacent 45deg sectors

const DIRECTION_ORDER: Direction[] = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
const DIRECTION_ANGLE_DEG: Record<Direction, number> = {
  E: 0,
  SE: 45,
  S: 90,
  SW: 135,
  W: 180,
  NW: 225,
  N: 270,
  NE: 315,
};
const CONTINUE_DIRECTION_CHANCE = 0.8; // how often a new wander target keeps heading roughly the same way
const CONTINUE_DIRECTION_SPREAD_DEG = 70; // max deviation from the previous heading when continuing

export function directionFromVector(dx: number, dy: number): Direction {
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const normalized = (deg + 360) % 360;
  const sector = Math.round(normalized / 45) % 8;
  return DIRECTION_ORDER[sector];
}

type Mode = "idle" | "seek";

/** "Where should the pet be right now" - target-based 2D movement with
 * normalized diagonal speed and smoothed acceleration/direction changes. */
export class MovementEngine {
  private x: number;
  private y: number;
  private bounds: WorkArea;
  private frameSize: { width: number; height: number };
  private speedMultiplier = 1;

  private mode: Mode = "idle";
  private target: { x: number; y: number } | null = null;
  private maxSpeed = BASE_WALK_SPEED;
  private velocity = { x: 0, y: 0 };
  private facing: Direction = "S";
  private horizontalBias: "left" | "right" = "right";
  private lastFacingChangeMs = 0;
  private elapsedMs = 0;

  constructor(
    initial: { x: number; y: number },
    bounds: WorkArea,
    frameSize: { width: number; height: number },
  ) {
    this.x = initial.x;
    this.y = initial.y;
    this.bounds = bounds;
    this.frameSize = frameSize;
  }

  setBounds(bounds: WorkArea) {
    this.bounds = bounds;
  }

  setSpeedMultiplier(multiplier: number) {
    this.speedMultiplier = multiplier;
  }

  getPosition() {
    return { x: this.x, y: this.y };
  }

  getFacing(): Direction {
    return this.facing;
  }

  /** Which way the pet was last actually heading, for single-pose states
   * (sleep, sit, ...) that only have one piece of art and need a mirror hint
   * instead of a real per-direction cycle. N/S don't affect this. */
  getHorizontalBias(): "left" | "right" {
    return this.horizontalBias;
  }

  private updateFacing(direction: Direction) {
    this.facing = direction;
    if (direction === "E" || direction === "NE" || direction === "SE") this.horizontalBias = "right";
    else if (direction === "W" || direction === "NW" || direction === "SW") this.horizontalBias = "left";
  }

  isMoving(): boolean {
    return this.mode === "seek";
  }

  /** Used by drag: snap position directly, no easing, no target. */
  setPositionImmediate(x: number, y: number, facing?: Direction) {
    this.x = this.clampX(x);
    this.y = this.clampY(y);
    this.velocity = { x: 0, y: 0 };
    this.mode = "idle";
    this.target = null;
    if (facing) this.updateFacing(facing);
  }

  stop() {
    this.mode = "idle";
    this.target = null;
    this.velocity = { x: 0, y: 0 };
  }

  /** Walk toward a specific point (already expected to be within bounds). */
  seekTo(targetX: number, targetY: number, maxSpeed: number) {
    this.mode = "seek";
    this.target = { x: this.clampX(targetX), y: this.clampY(targetY) };
    this.maxSpeed = maxSpeed;
  }

  /** Pick a natural-looking nearby destination and walk toward it. Mostly
   * keeps heading roughly the same way as before - fully random angles every
   * time made the pet look like it was pacing back and forth instead of
   * actually going somewhere. */
  wanderRandom(maxSpeed: number, minDistance = 100, maxDistance = 400) {
    let angleDeg: number;
    if (Math.random() < CONTINUE_DIRECTION_CHANCE) {
      const base = DIRECTION_ANGLE_DEG[this.facing];
      angleDeg = base + (Math.random() * 2 - 1) * CONTINUE_DIRECTION_SPREAD_DEG;
    } else {
      angleDeg = Math.random() * 360;
    }
    const angle = (angleDeg * Math.PI) / 180;
    const distance = minDistance + Math.random() * (maxDistance - minDistance);
    this.seekTo(this.x + Math.cos(angle) * distance, this.y + Math.sin(angle) * distance, maxSpeed);
  }

  wanderWalk() {
    this.wanderRandom(BASE_WALK_SPEED, 100, 350);
  }

  wanderRun() {
    this.wanderRandom(BASE_RUN_SPEED, 150, 500);
  }

  /** Rough time-to-arrival estimate for the current seek target, in ms. */
  estimatedArrivalMs(): number {
    if (this.mode !== "seek" || !this.target) return 0;
    const distance = Math.hypot(this.target.x - this.x, this.target.y - this.y);
    const speed = this.maxSpeed * this.speedMultiplier;
    return speed > 0 ? (distance / speed) * 1000 : 0;
  }

  /** Walk toward an absolute screen point (e.g. the cursor), same easing as wander. */
  seekScreenPoint(screenX: number, screenY: number, maxSpeed: number) {
    this.seekTo(screenX - this.frameSize.width / 2, screenY - this.frameSize.height / 2, maxSpeed);
  }

  private clampX(x: number) {
    const min = this.bounds.x;
    const max = this.bounds.x + this.bounds.width - this.frameSize.width;
    return Math.min(Math.max(x, min), max);
  }

  private clampY(y: number) {
    const min = this.bounds.y;
    const max = this.bounds.y + this.bounds.height - this.frameSize.height;
    return Math.min(Math.max(y, min), max);
  }

  update(dtMs: number): MovementResult {
    this.elapsedMs += dtMs;
    const dtSec = dtMs / 1000;

    if (this.mode !== "seek" || !this.target) {
      // Ease any residual velocity to zero so a just-stopped pet doesn't
      // snap dead - it settles like a real animal coming to rest.
      this.velocity.x += (0 - this.velocity.x) * Math.min(1, ACCEL_PER_SEC * dtSec);
      this.velocity.y += (0 - this.velocity.y) * Math.min(1, ACCEL_PER_SEC * dtSec);
      this.x = this.clampX(this.x + this.velocity.x * dtSec);
      this.y = this.clampY(this.y + this.velocity.y * dtSec);
      return { x: this.x, y: this.y, facing: this.facing, isMoving: false };
    }

    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const distance = Math.hypot(dx, dy);

    if (distance < ARRIVAL_THRESHOLD) {
      this.mode = "idle";
      this.target = null;
      this.velocity = { x: 0, y: 0 };
      return { x: this.x, y: this.y, facing: this.facing, isMoving: false };
    }

    // Unit vector toward the target - THIS is what keeps diagonal movement
    // from being faster than cardinal movement (no separately-additive dx/dy).
    const ux = dx / distance;
    const uy = dy / distance;

    const easedSpeed = this.maxSpeed * this.speedMultiplier * Math.min(1, distance / DECEL_RADIUS);
    const desiredVx = ux * easedSpeed;
    const desiredVy = uy * easedSpeed;

    const lerpAmount = Math.min(1, ACCEL_PER_SEC * dtSec);
    this.velocity.x += (desiredVx - this.velocity.x) * lerpAmount;
    this.velocity.y += (desiredVy - this.velocity.y) * lerpAmount;

    this.x = this.clampX(this.x + this.velocity.x * dtSec);
    this.y = this.clampY(this.y + this.velocity.y * dtSec);

    const speed = Math.hypot(this.velocity.x, this.velocity.y);
    if (speed > 2 && this.elapsedMs - this.lastFacingChangeMs > FACING_CHANGE_COOLDOWN_MS) {
      const nextFacing = directionFromVector(this.velocity.x, this.velocity.y);
      if (nextFacing !== this.facing) {
        this.updateFacing(nextFacing);
        this.lastFacingChangeMs = this.elapsedMs;
      }
    }

    return { x: this.x, y: this.y, facing: this.facing, isMoving: true };
  }
}
