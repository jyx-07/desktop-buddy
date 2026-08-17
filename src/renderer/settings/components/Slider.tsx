interface SliderProps {
  leftLabel: string;
  rightLabel: string;
  value: number; // 0..1
  onChange: (value: number) => void;
}

export function Slider({ leftLabel, rightLabel, value, onChange }: SliderProps) {
  return (
    <div className="slider-row">
      <div className="slider-labels">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
      <input
        className="slider-input"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
