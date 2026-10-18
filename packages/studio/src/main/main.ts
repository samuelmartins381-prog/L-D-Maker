// Electron main process of the Studio (ADR 0014): one window, a narrow IPC surface, files and
// keys handled here only. The interface runs sandboxed, without Node.
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import type { NewProject, Result, StudioLocale } from "../shared/api.ts";
import { estimate, generate } from "./generation.ts";
import {
  acquireLock,
  addSources,
  approveStoryboard,
  createProject,
  ingest,
  listProjects,
  projectDetail,
  releaseLock,
  releaseLockSync,
  removeSource,
  SOURCE_EXTENSIONS,
  saveStoryboard,
  storyboardDetail,
} from "./projects.ts";
import { getSettings, setApiKey, updateSettings } from "./settings.ts";

const HERE = fileURLToPath(new URL(".", import.meta.url));
// Tests run the Studio against a throwaway profile.
if (process.env.LDM_STUDIO_USER_DATA)
  app.setPath("userData", process.env.LDM_STUDIO_USER_DATA);

if (!app.requestSingleInstanceLock()) app.quit();

/** Projects opened by this Studio, whose locks are released on quit. */
const open = new Set<string>();
/** Last known user name, for the synchronous release of locks on quit. */
let user: string | undefined;

async function me(): Promise<string> {
  const name = (await getSettings()).userName;
  if (!name) throw new Error("no user name set");
  user = name;
  return name;
}

async function root(): Promise<string> {
  const dir = (await getSettings()).projectsDir;
  if (!dir) throw new Error("no projects folder chosen");
  return dir;
}

/** Wraps a handler so that errors reach the interface as values, not rejections. */
function handle<A extends unknown[], T>(
  name: string,
  fn: (...args: A) => Promise<T>,
): void {
  ipcMain.handle(`ldm:${name}`, async (_e, ...args): Promise<Result<T>> => {
    try {
      return { ok: true, value: await fn(...(args as A)) };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });
}

function registerIpc(win: BrowserWindow): void {
  ipcMain.handle("ldm:settings", () => getSettings());
  ipcMain.handle("ldm:setUserName", (_e, name: string) =>
    updateSettings({ userName: String(name).trim().slice(0, 60) }),
  );
  ipcMain.handle("ldm:setLocale", (_e, locale: StudioLocale) =>
    updateSettings({ locale }),
  );
  ipcMain.handle("ldm:chooseProjectsDir", async () => {
    const r = await dialog.showOpenDialog(win, {
      properties: ["openDirectory", "createDirectory"],
    });
    if (!r.canceled && r.filePaths[0])
      return updateSettings({ projectsDir: r.filePaths[0] });
    return getSettings();
  });
  handle("setApiKey", (key: string | null) => setApiKey(key));
  handle("listProjects", async () => listProjects(await root(), await me()));
  handle("createProject", async (input: NewProject) => {
    const detail = await createProject(await root(), input, await me());
    open.add(detail.dir);
    return detail;
  });
  handle("openProject", async (dir: string, force?: boolean) => {
    const who = await me();
    if (!(await acquireLock(dir, who, force))) open.add(dir);
    return projectDetail(dir, who);
  });
  ipcMain.handle("ldm:closeProject", async (_e, dir: string) => {
    open.delete(dir);
    await releaseLock(dir, await me()).catch(() => {});
  });
  ipcMain.handle("ldm:pickSources", async () => {
    const r = await dialog.showOpenDialog(win, {
      properties: ["openFile", "multiSelections"],
      filters: [
        {
          name: "Sources",
          extensions: SOURCE_EXTENSIONS.map((e) => e.slice(1)),
        },
      ],
    });
    return r.canceled ? [] : r.filePaths;
  });
  handle("addSources", async (dir: string, files: string[]) =>
    addSources(dir, files, await me()),
  );
  handle("removeSource", async (dir: string, file: string) =>
    removeSource(dir, file, await me()),
  );
  handle("ingest", async (dir: string) => ingest(dir, await me()));
  handle("estimateStoryboard", async (dir: string) =>
    estimate(dir, await root()),
  );
  handle("generateStoryboard", async (dir: string) =>
    generate(dir, await root(), await me(), (p) =>
      win.webContents.send("ldm:generationProgress", p),
    ),
  );
  handle("storyboard", async (dir: string) => storyboardDetail(dir));
  handle("saveStoryboard", async (dir: string, storyboard: unknown) =>
    saveStoryboard(dir, storyboard, await me()),
  );
  handle("approveStoryboard", async (dir: string) =>
    approveStoryboard(dir, await me()),
  );
  ipcMain.handle("ldm:openPath", async (_e, path: string) => {
    await shell.openPath(path);
  });
}

async function createWindow(): Promise<void> {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: "L-D-Maker Studio",
    backgroundColor: "#f7f4ee",
    webPreferences: {
      preload: join(HERE, "../preload/preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  // The interface never navigates away; links open in the system browser.
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  registerIpc(win);
  win.once("ready-to-show", () => win.show());
  await win.loadFile(join(HERE, "../renderer/index.html"));
}

app.on("second-instance", () => {
  const [win] = BrowserWindow.getAllWindows();
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on("before-quit", () => {
  // A lock left behind (crash, power cut) expires after LOCK_TTL_MS anyway.
  if (user) for (const dir of open) releaseLockSync(dir, user);
});

app.on("window-all-closed", () => app.quit());

void app.whenReady().then(createWindow);
