import { contextBridge, ipcRenderer } from "electron";
import { IpcChannel } from "../src/shared/ipc";
import type { PetApi, DeepPartial, SystemTickApi, SystemTickPayload } from "../src/shared/ipc";
import type { PetConfig } from "../src/types/pet";

const petAPI: PetApi = {
  getConfig: () => ipcRenderer.invoke(IpcChannel.ConfigGet),
  updateConfig: (patch: DeepPartial<PetConfig>) => ipcRenderer.invoke(IpcChannel.ConfigUpdate, patch),
  onConfigChanged: (cb: (config: PetConfig) => void) => {
    const listener = (_: unknown, config: PetConfig) => cb(config);
    ipcRenderer.on(IpcChannel.ConfigChanged, listener);
    return () => ipcRenderer.removeListener(IpcChannel.ConfigChanged, listener);
  },
  onPauseStateChanged: (cb: (paused: boolean) => void) => {
    const listener = (_: unknown, paused: boolean) => cb(paused);
    ipcRenderer.on(IpcChannel.PauseStateChanged, listener);
    return () => ipcRenderer.removeListener(IpcChannel.PauseStateChanged, listener);
  },
  getWorkArea: () => ipcRenderer.invoke(IpcChannel.GetWorkArea),
  setPosition: (x: number, y: number) => ipcRenderer.send(IpcChannel.PetSetPosition, { x, y }),
  setIgnoreMouseEvents: (ignore: boolean) =>
    ipcRenderer.send(IpcChannel.PetSetIgnoreMouseEvents, ignore),
  closeSettings: () => ipcRenderer.send(IpcChannel.SettingsClose),
};

const systemTickAPI: SystemTickApi = {
  onTick: (cb: (payload: SystemTickPayload) => void) => {
    const listener = (_: unknown, payload: SystemTickPayload) => cb(payload);
    ipcRenderer.on(IpcChannel.SystemTick, listener);
    return () => ipcRenderer.removeListener(IpcChannel.SystemTick, listener);
  },
};

contextBridge.exposeInMainWorld("petAPI", petAPI);
contextBridge.exposeInMainWorld("systemTickAPI", systemTickAPI);
