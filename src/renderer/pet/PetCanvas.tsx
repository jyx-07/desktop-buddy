import { forwardRef, useImperativeHandle, useRef } from "react";
import type { PetState } from "../../types/pet";

export interface PetCanvasHandle {
  applyFrame(
    frameSrc: string | undefined,
    state: PetState,
    horizontalBias: "left" | "right",
    scale: number,
  ): void;
}

interface PetCanvasProps {
  onPointerDown: (screenX: number, screenY: number) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

// walk/run/idle each have real art for every direction already, so they
// never need mirroring. Everything else is a single reused pose (sleep,
// sit, happy, ...) that only makes sense facing one way in the source art -
// mirror those based on which way the pet was last actually heading.
const DIRECTIONAL_STATES = new Set<PetState>(["walk", "run", "idle"]);

// Pure imperative sprite surface: PetRenderer's rAF loop calls applyFrame()
// directly on this ref every tick, bypassing React state/re-render entirely
// so animation performance never depends on React's render cycle.
export const PetCanvas = forwardRef<PetCanvasHandle, PetCanvasProps>(function PetCanvas(
  { onPointerDown, onMouseEnter, onMouseLeave },
  ref,
) {
  const imgRef = useRef<HTMLImageElement>(null);

  useImperativeHandle(ref, () => ({
    applyFrame(frameSrc, state, horizontalBias, scale) {
      const img = imgRef.current;
      if (!img) return;
      if (frameSrc && img.src !== frameSrc) img.src = frameSrc;
      const mirrored = !DIRECTIONAL_STATES.has(state) && horizontalBias === "left";
      // Anchor at bottom-center so a scale correction never lifts the feet
      // off the ground line - mirrors how the sprite sheet itself is
      // bottom-anchored.
      img.style.transformOrigin = "50% 100%";
      img.style.transform = `scale(${mirrored ? -scale : scale}, ${scale})`;
    },
  }));

  return (
    <div
      className="pet-card"
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <img
        ref={imgRef}
        alt=""
        draggable={false}
        onMouseDown={(e) => onPointerDown(e.screenX, e.screenY)}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          // This art is a softly anti-aliased "pixel-style" illustration, not
          // a true low-res pixel grid - nearest-neighbor (`pixelated`)
          // scaling made it look chunky/broken. Smooth scaling reads clean.
          imageRendering: "auto",
          cursor: "pointer",
        }}
      />
    </div>
  );
});
