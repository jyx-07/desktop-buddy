const DRAG_THRESHOLD_PX = 6;

interface PointerStart {
  screenX: number;
  screenY: number;
  windowX: number;
  windowY: number;
}

export type DragGestureResult =
  | { type: "none" }
  | { type: "drag-move"; windowX: number; windowY: number; dx: number; dy: number }
  | { type: "click" }
  | { type: "drag-end" };

/**
 * Pure click-vs-drag gesture classifier. No DOM, no window APIs - just the
 * "did the pointer move far enough to count as a drag" state machine and the
 * offset math so the pet follows wherever it was grabbed, not its center.
 */
export class DragController {
  private start: PointerStart | null = null;
  private dragging = false;
  private offsetX = 0;
  private offsetY = 0;
  private lastScreen = { x: 0, y: 0 };

  get isDragging(): boolean {
    return this.dragging;
  }

  pointerDown(screenX: number, screenY: number, windowX: number, windowY: number) {
    this.start = { screenX, screenY, windowX, windowY };
    this.dragging = false;
    this.offsetX = screenX - windowX;
    this.offsetY = screenY - windowY;
    this.lastScreen = { x: screenX, y: screenY };
  }

  pointerMove(screenX: number, screenY: number): DragGestureResult {
    if (!this.start) return { type: "none" };

    if (!this.dragging) {
      const dist = Math.hypot(screenX - this.start.screenX, screenY - this.start.screenY);
      if (dist < DRAG_THRESHOLD_PX) return { type: "none" };
      this.dragging = true;
    }

    const dx = screenX - this.lastScreen.x;
    const dy = screenY - this.lastScreen.y;
    this.lastScreen = { x: screenX, y: screenY };

    return {
      type: "drag-move",
      windowX: screenX - this.offsetX,
      windowY: screenY - this.offsetY,
      dx,
      dy,
    };
  }

  pointerUp(): DragGestureResult {
    const wasDragging = this.dragging;
    this.start = null;
    this.dragging = false;
    return wasDragging ? { type: "drag-end" } : { type: "click" };
  }
}
