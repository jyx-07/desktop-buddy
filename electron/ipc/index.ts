import { ipcMain, screen, type BrowserWindow } from "electron";
import { IpcChannel } from "../../src/shared/ipc";
import type { ConfigStore } from "../../src/config/ConfigStore";
import { SPEECH_HEADROOM_PX } from "../windows/createPetWindow";

interface IpcDeps {
  configStore: ConfigStore;
  getPetWindow: () => BrowserWindow | null;
  getSettingsWindowInstance: () => BrowserWindow | null;
}

export function registerIpcHandlers({ configStore, getPetWindow, getSettingsWindowInstance }: IpcDeps) {
  ipcMain.handle(IpcChannel.ConfigGet, () => configStore.get());

  ipcMain.handle(IpcChannel.ConfigUpdate, (_event, patch) => configStore.update(patch));

  ipcMain.handle(IpcChannel.GetWorkArea, () => screen.getPrimaryDisplay().workArea);

  ipcMain.on(IpcChannel.PetSetPosition, (_event, { x, y }: { x: number; y: number }) => {
    // (x, y) is the sprite's own top-left (movement/IPC coordinate space);
    // the actual window is taller and shifted up to leave room for a speech
    // bubble above the sprite - see SPEECH_HEADROOM_PX.
    const targetX = Math.round(x);
    const targetY = Math.round(y - SPEECH_HEADROOM_PX);
    // BrowserWindow.setPosition's native binding has thrown here even for
    // values that pass Number.isFinite AND a generous magnitude check -
    // whatever the exact trigger, it must never take the whole app down
    // with an "Uncaught Exception" dialog over a single dropped move.
    try {
      getPetWindow()?.setPosition(targetX, targetY);
    } catch (err) {
      console.error("[ipc] setPosition threw - dropping this update", {
        x,
        y,
        targetX,
        targetY,
        typeofX: typeof x,
        typeofY: typeof y,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  ipcMain.on(IpcChannel.PetSetIgnoreMouseEvents, (_event, ignore: boolean) => {
    getPetWindow()?.setIgnoreMouseEvents(ignore, { forward: true });
  });

  ipcMain.on(IpcChannel.SettingsClose, () => {
    getSettingsWindowInstance()?.close();
  });

  configStore.onChange((config) => {
    getPetWindow()?.webContents.send(IpcChannel.ConfigChanged, config);
    getSettingsWindowInstance()?.webContents.send(IpcChannel.ConfigChanged, config);
  });
}
