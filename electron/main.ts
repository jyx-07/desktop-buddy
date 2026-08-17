import { app, screen, powerMonitor, BrowserWindow } from "electron";
import { ConfigStore } from "../src/config/ConfigStore";
import { createPetWindow, petWindowSize } from "./windows/createPetWindow";
import { getSettingsWindow } from "./windows/createSettingsWindow";
import { createTray } from "./tray";
import { registerIpcHandlers } from "./ipc";
import { IpcChannel } from "../src/shared/ipc";

let petWindow: BrowserWindow | null = null;
let paused = false;

// Menu-bar/desktop-overlay app - no Dock icon, no app menu window.
app.dock?.hide();

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

  // Keep the window's on-screen size in sync when the user changes the
  // "size" slider in Settings, without requiring a restart.
  configStore.onChange((config) => {
    if (!petWindow || petWindow.isDestroyed()) return;
    const { width, height } = petWindowSize(config.appearance.scale);
    const bounds = petWindow.getBounds();
    if (bounds.width === width && bounds.height === height) return;
    const workArea = screen.getPrimaryDisplay().workArea;
    petWindow.setBounds({
      x: bounds.x,
      y: workArea.y + workArea.height - height,
      width,
      height,
    });
  });

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
