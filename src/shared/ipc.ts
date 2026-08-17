// Shared IPC channel contract. Import from main, preload, and renderer so the
// channel names and payload shapes can never drift apart.

import type { PetConfig } from "../types/pet";

export const IpcChannel = {
  // renderer -> main (fire-and-forget)
  PetSetPosition: "pet:set-position",
  PetSetIgnoreMouseEvents: "pet:set-ignore-mouse-events",
  SettingsClose: "settings:close",

  // renderer <-> main (invoke/handle)
  ConfigGet: "config:get",
  ConfigUpdate: "config:update",
  GetWorkArea: "system:get-work-area",

  // main -> renderer (broadcast)
  ConfigChanged: "config:changed",
  PauseStateChanged: "pet:pause-state-changed",
  SystemTick: "system:tick",
} as const;

export interface WorkArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PetApi {
  getConfig(): Promise<PetConfig>;
  updateConfig(patch: DeepPartial<PetConfig>): Promise<PetConfig>;
  onConfigChanged(cb: (config: PetConfig) => void): () => void;
  onPauseStateChanged(cb: (paused: boolean) => void): () => void;
  getWorkArea(): Promise<WorkArea>;
  setPosition(x: number, y: number): void;
  setIgnoreMouseEvents(ignore: boolean): void;
  closeSettings(): void;
}

export type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

export interface SystemTickPayload {
  cursor: { x: number; y: number };
  idleSeconds: number;
  timeOfDay: { hour: number; minute: number };
}

export interface SystemTickApi {
  onTick(cb: (payload: SystemTickPayload) => void): () => void;
}

declare global {
  interface Window {
    petAPI: PetApi;
    systemTickAPI: SystemTickApi;
  }
}
