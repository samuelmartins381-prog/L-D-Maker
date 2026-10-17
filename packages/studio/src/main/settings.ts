// Studio settings, kept in the user's profile (never in the shared folder). The API key is
// encrypted by the system keychain through Electron's safeStorage (ADR 0014).
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { app, safeStorage } from "electron";
import {
  type Settings,
  STUDIO_LOCALES,
  type StudioLocale,
} from "../shared/api.ts";

interface Stored {
  projectsDir?: string;
  userName?: string;
  locale?: StudioLocale;
}

const file = () => join(app.getPath("userData"), "settings.json");
const keyFile = () => join(app.getPath("userData"), "api-key.bin");

/** A real keychain: Linux's "basic_text" fallback only obfuscates, so it does not count. */
export function canStoreKey(): boolean {
  if (!safeStorage.isEncryptionAvailable()) return false;
  return (
    process.platform !== "linux" ||
    safeStorage.getSelectedStorageBackend() !== "basic_text"
  );
}

async function readStored(): Promise<Stored> {
  try {
    return JSON.parse(await readFile(file(), "utf8")) as Stored;
  } catch {
    return {};
  }
}

async function writeStored(s: Stored): Promise<void> {
  await mkdir(app.getPath("userData"), { recursive: true });
  await writeFile(file(), `${JSON.stringify(s, null, 2)}\n`);
}

function defaultLocale(): StudioLocale {
  return app.getLocale().toLowerCase().startsWith("fr") ? "fr" : "en";
}

export async function getSettings(): Promise<Settings> {
  const s = await readStored();
  return {
    ...(s.projectsDir ? { projectsDir: s.projectsDir } : {}),
    ...(s.userName ? { userName: s.userName } : {}),
    hasApiKey: await readFile(keyFile()).then(
      () => true,
      () => false,
    ),
    canStoreKey: canStoreKey(),
    canGenerate:
      Boolean(process.env.LDM_STUDIO_FAKE_LLM) ||
      (await readFile(keyFile()).then(
        () => true,
        () => false,
      )),
    locale:
      s.locale && STUDIO_LOCALES.includes(s.locale)
        ? s.locale
        : defaultLocale(),
  };
}

export async function updateSettings(patch: Stored): Promise<Settings> {
  await writeStored({ ...(await readStored()), ...patch });
  return getSettings();
}

export async function setApiKey(key: string | null): Promise<Settings> {
  if (key === null) {
    await rm(keyFile(), { force: true });
    return getSettings();
  }
  if (!canStoreKey())
    throw new Error("no system keychain available to store the key safely");
  await mkdir(app.getPath("userData"), { recursive: true });
  await writeFile(keyFile(), safeStorage.encryptString(key.trim()));
  return getSettings();
}

/** The key, for the generation engine (step 2); undefined when none is stored. */
export async function getApiKey(): Promise<string | undefined> {
  try {
    return safeStorage.decryptString(await readFile(keyFile()));
  } catch {
    return undefined;
  }
}
