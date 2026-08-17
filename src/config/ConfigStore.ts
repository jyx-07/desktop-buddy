// Main-process only: owns the on-disk copy of PetConfig. Never imported from
// the renderer - the renderer only ever sees config through IPC.
import fs from "node:fs";
import path from "node:path";
import type { DeepPartial } from "../shared/ipc";
import type { PetConfig } from "../types/pet";
import { createDefaultPetConfig, mergeWithDefaults } from "./PetConfig";

function deepMerge<T>(base: T, patch: DeepPartial<T>): T {
  const result: any = Array.isArray(base) ? [...(base as any)] : { ...base };
  for (const key of Object.keys(patch as object)) {
    const patchValue = (patch as any)[key];
    const baseValue = (base as any)[key];
    if (
      patchValue &&
      typeof patchValue === "object" &&
      !Array.isArray(patchValue) &&
      baseValue &&
      typeof baseValue === "object" &&
      !Array.isArray(baseValue)
    ) {
      result[key] = deepMerge(baseValue, patchValue);
    } else if (patchValue !== undefined) {
      result[key] = patchValue;
    }
  }
  return result;
}

export class ConfigStore {
  private filePath: string;
  private config: PetConfig;
  private listeners = new Set<(config: PetConfig) => void>();

  constructor(userDataDir: string) {
    this.filePath = path.join(userDataDir, "pet-config.json");
    this.config = this.load();
  }

  private load(): PetConfig {
    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      return mergeWithDefaults(JSON.parse(raw));
    } catch {
      return createDefaultPetConfig();
    }
  }

  private persist() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.config, null, 2), "utf-8");
  }

  get(): PetConfig {
    return this.config;
  }

  update(patch: DeepPartial<PetConfig>): PetConfig {
    this.config = deepMerge(this.config, patch);
    this.persist();
    for (const listener of this.listeners) listener(this.config);
    return this.config;
  }

  onChange(listener: (config: PetConfig) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
