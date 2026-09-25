/**
 * Pure data directory resolver per Doc 16 §3D and Threat Model T-15.
 *
 * Validates absolute paths and rejects relative paths, UNC/device paths,
 * and system roots. Resolves OS-specific defaults.
 */

import path from "node:path";
import { StoreError } from "./error.js";
import type { ResolveDataDirOptions } from "./types.js";

const PRODUCT_REGEX = /^[a-zA-Z0-9_-]+$/;
const WIN_DRIVE_REGEX = /^[a-zA-Z]:[\\/]/;
const WIN_ROOT_ONLY_REGEX = /^[a-zA-Z]:[\\/]?$/;

function isWinSystemRoot(normPath: string): boolean {
  if (WIN_ROOT_ONLY_REGEX.test(normPath)) {
    return true;
  }
  const lower = normPath.toLowerCase();
  const afterDrive = lower.slice(3);
  const sysDirs = [
    "windows",
    "winnt",
    "program files",
    "program files (x86)",
    "system",
    "etc",
    "usr",
    "bin",
  ];
  for (const sys of sysDirs) {
    if (
      afterDrive === sys ||
      afterDrive.startsWith(`${sys}\\`) ||
      afterDrive.startsWith(`${sys}/`)
    ) {
      return true;
    }
  }
  return false;
}

function isPosixSystemRoot(normPath: string): boolean {
  if (normPath === "/") {
    return true;
  }
  const sysDirs = ["/etc", "/usr", "/bin", "/System", "/sbin", "/var"];
  for (const sys of sysDirs) {
    if (normPath === sys || normPath.startsWith(`${sys}/`)) {
      return true;
    }
  }
  return false;
}

export function resolveDataDir(opts: ResolveDataDirOptions): string {
  const { envValue, product, platform, home, appData, xdgDataHome } = opts;

  if (!PRODUCT_REGEX.test(product)) {
    throw new StoreError("INVALID_DATA_DIR", "Invalid product name");
  }

  // 1. Explicit envValue specified
  if (envValue !== undefined && envValue.trim() !== "") {
    const raw = envValue.trim();

    // Reject UNC and device paths
    if (
      raw.startsWith("\\\\") ||
      raw.startsWith("//") ||
      raw.includes("\\?\\") ||
      raw.includes("/?/")
    ) {
      throw new StoreError("INVALID_DATA_DIR", "UNC and device paths are forbidden");
    }

    if (platform === "win32") {
      if (!WIN_DRIVE_REGEX.test(raw)) {
        throw new StoreError(
          "INVALID_DATA_DIR",
          "Windows data directory must be an absolute drive path",
        );
      }
      const normalized = path.win32.normalize(raw);
      if (isWinSystemRoot(normalized)) {
        throw new StoreError("INVALID_DATA_DIR", "System root directories are forbidden");
      }
      return normalized;
    }

    // POSIX platforms (darwin, linux, etc.)
    if (!raw.startsWith("/")) {
      throw new StoreError(
        "INVALID_DATA_DIR",
        "POSIX data directory must be an absolute path starting with /",
      );
    }
    const normalized = path.posix.normalize(raw);
    if (isPosixSystemRoot(normalized)) {
      throw new StoreError("INVALID_DATA_DIR", "System root directories are forbidden");
    }
    return normalized;
  }

  // 2. Default platform directory
  if (platform === "win32") {
    if (appData && appData.trim() !== "") {
      return path.win32.join(appData.trim(), product);
    }
    if (home && home.trim() !== "") {
      return path.win32.join(home.trim(), "AppData", "Roaming", product);
    }
    throw new StoreError(
      "INVALID_DATA_DIR",
      "Cannot resolve Windows default data dir without APPDATA or HOME",
    );
  }

  if (platform === "darwin") {
    if (home && home.trim() !== "") {
      return path.posix.join(home.trim(), "Library", "Application Support", product);
    }
    throw new StoreError("INVALID_DATA_DIR", "Cannot resolve macOS default data dir without HOME");
  }

  // Linux and other POSIX
  if (xdgDataHome && xdgDataHome.trim() !== "") {
    return path.posix.join(xdgDataHome.trim(), product);
  }
  if (home && home.trim() !== "") {
    return path.posix.join(home.trim(), ".local", "share", product);
  }
  throw new StoreError(
    "INVALID_DATA_DIR",
    "Cannot resolve Linux default data dir without XDG_DATA_HOME or HOME",
  );
}
