import { useEffect, useRef, useState } from "react";
import { PetEngine } from "../../engine/PetEngine";
import { getPetDefinition } from "../../pets/puppy/Puppy";
import { PetCanvas, type PetCanvasHandle } from "./PetCanvas";

export function PetRenderer() {
  const engineRef = useRef<PetEngine | null>(null);
  const canvasRef = useRef<PetCanvasHandle>(null);
  const [ready, setReady] = useState(false);
  const lastSent = useRef({ x: NaN, y: NaN });

  useEffect(() => {
    let disposed = false;
    let rafId = 0;
    let lastTs = 0;
    let unsubConfig: (() => void) | undefined;
    let unsubPause: (() => void) | undefined;
    let unsubTick: (() => void) | undefined;

    async function init() {
      const [config, workArea] = await Promise.all([
        window.petAPI.getConfig(),
        window.petAPI.getWorkArea(),
      ]);
      if (disposed) return;

      const definition = getPetDefinition(config.petId);
      const engine = new PetEngine(definition, config, workArea);
      engineRef.current = engine;
      setReady(true);

      unsubConfig = window.petAPI.onConfigChanged((next) => engine.setConfig(next));
      unsubPause = window.petAPI.onPauseStateChanged((paused) => engine.setPaused(paused));
      unsubTick = window.systemTickAPI.onTick(({ cursor, idleSeconds, timeOfDay }) => {
        engine.applySystemTick(cursor, idleSeconds, timeOfDay);
      });

      const loop = (ts: number) => {
        const dt = lastTs ? ts - lastTs : 16;
        lastTs = ts;

        const snapshot = engine.update(dt);
        canvasRef.current?.applyFrame(snapshot.frameSrc, snapshot.state, snapshot.horizontalBias, snapshot.scale);

        if (snapshot.x !== lastSent.current.x || snapshot.y !== lastSent.current.y) {
          lastSent.current = { x: snapshot.x, y: snapshot.y };
          window.petAPI.setPosition(snapshot.x, snapshot.y);
        }

        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);
    }

    init();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      unsubConfig?.();
      unsubPause?.();
      unsubTick?.();
    };
  }, []);

  // Drag tracking lives at window level (not on the sprite element) so the
  // gesture keeps following the cursor even if it briefly outruns the small
  // sprite/window during a fast drag - the OS keeps delivering mouse events
  // to whichever window received the initial mousedown.
  const handlePointerDown = (screenX: number, screenY: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.handlePointerDown(screenX, screenY);

    const handleMove = (e: MouseEvent) => {
      const pos = engine.handlePointerMove(e.screenX, e.screenY);
      // Send the new position immediately instead of waiting for the next
      // rAF tick to notice it - shaves a frame of latency off dragging so it
      // never feels like it's chasing the cursor.
      if (pos) {
        lastSent.current = pos;
        window.petAPI.setPosition(pos.x, pos.y);
      }
    };
    const handleUp = () => {
      engine.handlePointerUp();
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  if (!ready) return null;

  return (
    <PetCanvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onMouseEnter={() => window.petAPI.setIgnoreMouseEvents(false)}
      onMouseLeave={() => {
        // Don't let a fast drag re-enable click-through just because the
        // cursor slipped off the sprite for a frame.
        if (!engineRef.current?.isDragging) window.petAPI.setIgnoreMouseEvents(true);
      }}
    />
  );
}
