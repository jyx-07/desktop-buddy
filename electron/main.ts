import { app, screen, powerMonitor, BrowserWindow } from "electron";
import { ConfigStore } from "../src/config/ConfigStore";
import { createPetWindow } from "./windows/createPetWindow";
import { getSettingsWindow } from "./windows/createSettingsWindow";
import { createTray } from "./tray";
import { registerIpcHandlers } from "./ipc";
import { IpcChannel } from "../src/shared/ipc";

let petWindow: BrowserWindow | null = null;
let paused = false;

// Menu-bar/desktop-overlay app - no Dock icon, no app menu window.
app.dock?.hide();

// Last-resort net: an uncaught exception anywhere in the main process would
// otherwise show Electron's "A JavaScript error occurred" dialog and often
// take the whole tray-resident app down over one bad tick. Log and keep
// running instead - this is a background pet, not something that should
// ever surface a crash dialog to the user.
process.on("uncaughtException", (err) => {
  console.error("[main] uncaught exception - continuing", err);
});

app.whenReady().then(() => {
  const configStore = new ConfigStore(app.getPath("userData"));

  petWindow = createPetWindow(configStore.get());

  registerIpcHandlers({
    configStore,
    getPetWindow: () => petWindow,
    getSettingsWindowInstance: () => getSettingsWindow(),
  });

  createTray({
    getPetWindow: () => petWindow,
    isPaused: () => paused,
    setPaused: (value) => {
      paused = value;
      petWindow?.webContents.send(IpcChannel.PauseStateChanged, paused);
    },
  });

  // Broadcast cursor position + system-wide idle time + time-of-day once a
  // second so the renderer's rule engine / cursor-attention behavior can
  // react without every window needing its own OS polling.
  setInterval(() => {
    if (!petWindow || petWindow.isDestroyed()) return;
    const cursor = screen.getCursorScreenPoint();
    const idleSeconds = powerMonitor.getSystemIdleTime();
    const now = new Date();
    petWindow.webContents.send(IpcChannel.SystemTick, {
      cursor,
      idleSeconds,
      timeOfDay: { hour: now.getHours(), minute: now.getMinutes() },
    });
  }, 1000);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      petWindow = createPetWindow(configStore.get());
    }
  });
});

// Tray-resident app: closing windows shouldn't quit it. Quitting only
// happens via the tray's "종료" menu item.
app.on("window-all-closed", () => {
  // intentionally no-op
});
