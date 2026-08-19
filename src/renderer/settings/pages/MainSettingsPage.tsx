import type { PetConfig } from "../../../types/pet";
import { Section } from "../components/Section";
import { Slider } from "../components/Slider";
import { TextField } from "../components/TextField";
import { Toggle } from "../components/Toggle";

interface MainSettingsPageProps {
  config: PetConfig;
  onChange: (patch: DeepPartialConfig) => void;
}

// A tiny local DeepPartial so this file doesn't need to import the shared
// IPC-oriented DeepPartial type just for prop typing.
type DeepPartialConfig = {
  name?: string;
  appearance?: Partial<PetConfig["appearance"]>;
  personality?: Partial<PetConfig["personality"]>;
  behavior?: Partial<PetConfig["behavior"]>;
  activityLevel?: number;
  moveSpeed?: number;
};

export function MainSettingsPage({ config, onChange }: MainSettingsPageProps) {
  const { personality, behavior } = config;

  return (
    <>
      <Section title="기본 설정">
        <TextField label="이름" value={config.name} onChange={(name) => onChange({ name })} placeholder="펫 이름" />
        <Slider
          leftLabel="느리게"
          rightLabel="빠르게"
          value={(config.moveSpeed - 0.5) / 1.5}
          onChange={(v) => onChange({ moveSpeed: 0.5 + v * 1.5 })}
        />
      </Section>

      <Section title="성격">
        <Slider
          leftLabel="조용함"
          rightLabel="활발함"
          value={personality.energy}
          onChange={(v) => onChange({ personality: { energy: v } })}
        />
        <Slider
          leftLabel="낯가림"
          rightLabel="친화적"
          value={personality.friendliness}
          onChange={(v) => onChange({ personality: { friendliness: v } })}
        />
        <Slider
          leftLabel="게으름"
          rightLabel="부지런함"
          value={1 - personality.sleepiness}
          onChange={(v) => onChange({ personality: { sleepiness: 1 - v } })}
        />
        <Slider
          leftLabel="차분함"
          rightLabel="장난꾸러기"
          value={personality.playfulness}
          onChange={(v) => onChange({ personality: { playfulness: v } })}
        />
        <Slider
          leftLabel="무관심"
          rightLabel="호기심 많음"
          value={personality.curiosity}
          onChange={(v) => onChange({ personality: { curiosity: v } })}
        />
      </Section>

      <Section title="행동">
        <div className="toggle-grid">
          <Toggle label="걷기" checked={behavior.walking} onChange={(v) => onChange({ behavior: { walking: v } })} />
          <Toggle label="뛰기" checked={behavior.running} onChange={(v) => onChange({ behavior: { running: v } })} />
          <Toggle label="앉기" checked={behavior.sitting} onChange={(v) => onChange({ behavior: { sitting: v } })} />
          <Toggle label="자기" checked={behavior.sleeping} onChange={(v) => onChange({ behavior: { sleeping: v } })} />
          <Toggle label="하품" checked={behavior.yawning} onChange={(v) => onChange({ behavior: { yawning: v } })} />
          <Toggle
            label="커서 바라보기"
            checked={behavior.lookAtCursor}
            onChange={(v) => onChange({ behavior: { lookAtCursor: v } })}
          />
          <Toggle
            label="커서 따라가기"
            checked={behavior.followCursor}
            onChange={(v) => onChange({ behavior: { followCursor: v } })}
          />
          <Toggle
            label="갑자기 뛰어가기"
            checked={behavior.suddenDash}
            onChange={(v) => onChange({ behavior: { suddenDash: v } })}
          />
          <Toggle
            label="클릭하면 반응하기"
            checked={behavior.cursorInteraction}
            onChange={(v) => onChange({ behavior: { cursorInteraction: v } })}
          />
          <Toggle
            label="마우스로 드래그"
            checked={behavior.dragging}
            onChange={(v) => onChange({ behavior: { dragging: v } })}
          />
        </div>
      </Section>

      <Section title="활동량">
        <Slider
          leftLabel="조용함"
          rightLabel="활발함"
          value={config.activityLevel}
          onChange={(v) => onChange({ activityLevel: v })}
        />
      </Section>
    </>
  );
}
