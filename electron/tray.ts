import { Tray, Menu, BrowserWindow, app, nativeImage } from "electron";
import path from "node:path";
import { openSettingsWindow } from "./windows/createSettingsWindow";

interface TrayDeps {
  getPetWindow: () => BrowserWindow | null;
  isPaused: () => boolean;
  setPaused: (paused: boolean) => void;
}

export function createTray(deps: TrayDeps): Tray {
  const iconPath = path.join(__dirname, "../../assets/icons/tray-icon.png");
  const icon = nativeImage.createFromPath(iconPath);
  const tray = new Tray(icon);
  tray.setToolTip("My Pet");

  const rebuildMenu = () => {
    const petWindow = deps.getPetWindow();
    const visible = petWindow?.isVisible() ?? true;
    const paused = deps.isPaused();

    const menu = Menu.buildFromTemplate([
      { label: "🐶 My Pet", enabled: false },
      { type: "separator" },
      {
        label: visible ? "Pet 숨기기" : "Pet 표시",
        click: () => {
          const win = deps.getPetWindow();
          if (!win) return;
          if (win.isVisible()) win.hide();
          else win.show();
          rebuildMenu();
        },
      },
      { type: "separator" },
      {
        label: "설정",
        click: () => openSettingsWindow(),
      },
      { type: "separator" },
      {
        label: paused ? "다시 시작" : "일시정지",
        click: () => {
          deps.setPaused(!paused);
          rebuildMenu();
        },
      },
      { type: "separator" },
      {
        label: "종료",
        click: () => app.quit(),
      },
    ]);
    tray.setContextMenu(menu);
  };

  rebuildMenu();
  return tray;
}
