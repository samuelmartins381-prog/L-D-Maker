// The only bridge between the sandboxed interface and the main process (ADR 0014).
import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { StudioApi } from "../shared/api.ts";

const call =
  (name: string) =>
  (...args: unknown[]) =>
    ipcRenderer.invoke(`ldm:${name}`, ...args);

const api: StudioApi = {
  settings: call("settings"),
  setUserName: call("setUserName"),
  setLocale: call("setLocale"),
  chooseProjectsDir: call("chooseProjectsDir"),
  setApiKey: call("setApiKey"),
  listProjects: call("listProjects"),
  createProject: call("createProject"),
  openProject: call("openProject"),
  closeProject: call("closeProject"),
  pickSources: call("pickSources"),
  pathForFile: (file: File) => webUtils.getPathForFile(file),
  addSources: call("addSources"),
  removeSource: call("removeSource"),
  ingest: call("ingest"),
  openPath: call("openPath"),
} as StudioApi;

contextBridge.exposeInMainWorld("ldm", api);
