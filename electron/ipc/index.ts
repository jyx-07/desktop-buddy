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
    // BrowserWindow.setPosition throws a native TypeError on NaN/Infinity -
    // crashing the whole app with an ugly dialog instead of just dropping
    // the one bad update. Guard rather than chase every possible NaN source.
    if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
      console.error("[ipc] dropped non-finite pet position", { x, y });
      return;
    }
    getPetWindow()?.setPosition(targetX, targetY);
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
