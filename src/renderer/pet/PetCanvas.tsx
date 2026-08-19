import { forwardRef, useImperativeHandle, useRef } from "react";

export interface PetCanvasHandle {
  applyFrame(frameSrc: string | undefined, mirrored: boolean, scale: number, offsetXPercent: number): void;
}

interface PetCanvasProps {
  onPointerDown: (screenX: number, screenY: number) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

// Pure imperative sprite surface: PetRenderer's rAF loop calls applyFrame()
// directly on this ref every tick, bypassing React state/re-render entirely
// so animation performance never depends on React's render cycle.
export const PetCanvas = forwardRef<PetCanvasHandle, PetCanvasProps>(function PetCanvas(
  { onPointerDown, onMouseEnter, onMouseLeave },
  ref,
) {
  const imgRef = useRef<HTMLImageElement>(null);

  useImperativeHandle(ref, () => ({
    applyFrame(frameSrc, mirrored, scale, offsetXPercent) {
      const img = imgRef.current;
      if (!img) return;
      if (frameSrc && img.src !== frameSrc) img.src = frameSrc;
      // Anchor at bottom-center so a scale correction never lifts the feet
      // off the ground line - mirrors how the sprite sheet itself is
      // bottom-anchored.
      img.style.transformOrigin = "50% 100%";
      // translateX first (in the frame's own original orientation), then
      // scale/mirror - so a mirrored frame's offset flips direction along
      // with it, still compensating correctly.
      img.style.transform = `scale(${mirrored ? -scale : scale}, ${scale}) translateX(${offsetXPercent}%)`;
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
