import { useEffect, useRef, useState } from "react";
import type { PetConfig } from "../../types/pet";
import type { DeepPartial } from "../../shared/ipc";
import { MainSettingsPage } from "./pages/MainSettingsPage";
import previewSrc from "../../pets/puppy/assets/idle/frame1.png";

export function SettingsApp() {
  const [config, setConfig] = useState<PetConfig | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<number | undefined>(undefined);
  const pendingPatch = useRef<DeepPartial<PetConfig>>({});

  useEffect(() => {
    window.petAPI.getConfig().then(setConfig);
    const unsub = window.petAPI.onConfigChanged(setConfig);
    return unsub;
  }, []);

  function mergeLocal(base: PetConfig, patch: DeepPartial<PetConfig>): PetConfig {
    return {
      ...base,
      ...patch,
      appearance: { ...base.appearance, ...patch.appearance },
      personality: { ...base.personality, ...patch.personality },
      behavior: { ...base.behavior, ...patch.behavior },
    } as PetConfig;
  }

  function handleChange(patch: DeepPartial<PetConfig>) {
    setConfig((prev) => (prev ? mergeLocal(prev, patch) : prev));

    pendingPatch.current = mergeLocal(pendingPatch.current as PetConfig, patch) as unknown as DeepPartial<PetConfig>;
    setStatus("saving");
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      const patchToSend = pendingPatch.current;
      pendingPatch.current = {};
      await window.petAPI.updateConfig(patchToSend);
      setStatus("saved");
    }, 250);
  }

  if (!config) return null;

  return (
    <div className="settings-app">
      <div className="settings-header">
        <img src={previewSrc} alt="" />
        <div>
          <h1>{config.name || "내 강아지"}</h1>
          <p>맥 바탕화면 위의 작은 친구를 취향대로 꾸며보세요</p>
        </div>
      </div>

      <MainSettingsPage config={config} onChange={handleChange} />

      <div className="status-line">
        {status === "saving" ? "저장 중..." : status === "saved" ? "저장됨 - 펫에게 바로 반영됩니다" : ""}
      </div>
    </div>
  );
}
