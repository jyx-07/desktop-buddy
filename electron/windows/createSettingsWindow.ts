import { BrowserWindow } from "electron";
import path from "node:path";

const isDev = process.env.NODE_ENV === "development";

let settingsWindow: BrowserWindow | null = null;

export function openSettingsWindow(): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return settingsWindow;
  }

  settingsWindow = new BrowserWindow({
    width: 420,
    height: 680,
    minWidth: 380,
    minHeight: 560,
    title: "내 강아지 설정",
    show: false,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#FFF8EF",
    webPreferences: {
      preload: path.join(__dirname, "../preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // The default sandboxed preload environment can only `require` a
      // short allow-list of built-ins - our preload imports local shared
      // modules (types/IPC contract), so it needs the full preload context.
      sandbox: false,
    },
  });

  if (isDev) {
    settingsWindow.loadURL("http://localhost:5173/settings.html");
  } else {
    settingsWindow.loadFile(path.join(__dirname, "../../../dist/settings.html"));
  }

  settingsWindow.once("ready-to-show", () => settingsWindow?.show());
  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });

  return settingsWindow;
}

export function getSettingsWindow(): BrowserWindow | null {
  return settingsWindow;
}
