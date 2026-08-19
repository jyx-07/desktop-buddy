import { BrowserWindow, screen } from "electron";
import path from "node:path";
import { PUPPY_DISPLAY_BASE_HEIGHT, PUPPY_FRAME_SIZE } from "../../src/pets/puppy/puppy.meta";
import { computeDisplaySize } from "../../src/types/pet";
import type { PetConfig } from "../../src/types/pet";

const isDev = process.env.NODE_ENV === "development";

// Extra transparent space reserved above the sprite's own bounding box, so a
// speech bubble has somewhere to render without needing to resize the window
// every time one pops up. Purely a window-chrome concern - the pet's own
// logical position/frameSize (movement bounds, IPC) stays sprite-sized;
// only the actual BrowserWindow is taller/shifted up by this amount (see
// SPEECH_HEADROOM_PX usage in electron/ipc/index.ts for the position offset).
export const SPEECH_HEADROOM_PX = 48;

export function petWindowSize() {
  return computeDisplaySize({
    frameSize: PUPPY_FRAME_SIZE,
    displayBaseHeight: PUPPY_DISPLAY_BASE_HEIGHT,
  });
}

export function createPetWindow(config: PetConfig): BrowserWindow {
  const { width, height } = petWindowSize();
  const workArea = screen.getPrimaryDisplay().workArea;

  const win = new BrowserWindow({
    width,
    height: height + SPEECH_HEADROOM_PX,
    x: Math.round(config.position.x),
    y: workArea.y + workArea.height - height - SPEECH_HEADROOM_PX,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    focusable: false,
    fullscreenable: false,
    show: false,
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

  win.setAlwaysOnTop(true, "floating");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // Click-through by default; the renderer flips this off while the cursor
  // is actually hovering the pet sprite (see PetRenderer's onMouseEnter/Leave).
  win.setIgnoreMouseEvents(true, { forward: true });

  if (isDev) {
    win.loadURL("http://localhost:5173/pet.html");
  } else {
    win.loadFile(path.join(__dirname, "../../../dist/pet.html"));
  }

  // "ready-to-show" doesn't always fire reliably for transparent/frameless
  // windows on macOS - back it up with did-finish-load so the window never
  // stays invisible just because that event was missed.
  win.once("ready-to-show", () => win.show());
  win.webContents.once("did-finish-load", () => win.show());

  win.webContents.on("did-fail-load", (_e, code, description) => {
    console.error("[pet window] failed to load:", code, description);
  });
  win.webContents.on("render-process-gone", (_e, details) => {
    console.error("[pet window] renderer process gone:", details);
  });

  if (isDev) {
    console.log("[pet window] bounds:", win.getBounds());
    win.webContents.openDevTools({ mode: "detach" });
  }

  return win;
}
