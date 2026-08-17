import { ipcMain, screen, type BrowserWindow } from "electron";
import { IpcChannel } from "../../src/shared/ipc";
import type { ConfigStore } from "../../src/config/ConfigStore";

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
    getPetWindow()?.setPosition(Math.round(x), Math.round(y));
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
