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
    // AND on merely huge-but-finite values (seen in practice: passed a
    // plain Number.isFinite check yet still failed) - crashing the whole
    // app with an ugly dialog instead of just dropping the one bad update.
    // No real desktop position is anywhere near this magnitude, so bound
    // it outright rather than keep chasing the exact source.
    const MAX_COORD = 20000;
    const valid =
      Number.isFinite(targetX) &&
      Number.isFinite(targetY) &&
      Math.abs(targetX) <= MAX_COORD &&
      Math.abs(targetY) <= MAX_COORD;
    if (!valid) {
      console.error("[ipc] dropped out-of-range pet position", { x, y, targetX, targetY });
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
