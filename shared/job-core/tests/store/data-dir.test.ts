import { describe, expect, it } from "vitest";
import { StoreError } from "../../src/store/error.js";
import { resolveDataDir } from "../../src/store/data-dir.js";

describe("resolveDataDir", () => {
  describe("product name validation", () => {
    it("accepts valid alphanumeric product names with hyphens and underscores", () => {
      const res = resolveDataDir({
        product: "naukri-mcp_v1",
        platform: "linux",
        home: "/home/user",
      });
      expect(res).toBe("/home/user/.local/share/naukri-mcp_v1");
    });

    it("rejects path traversal or illegal characters in product name", () => {
      const invalidProducts = [
        "../naukri",
        "naukri/mcp",
        "naukri\\mcp",
        "",
        "naukri*mcp",
        "naukri:mcp",
      ];
      for (const product of invalidProducts) {
        expect(
          () =>
            resolveDataDir({
              product,
              platform: "linux",
              home: "/home/user",
            }),
          `Should reject product name: ${product}`,
        ).toThrow(StoreError);
      }
    });
  });

  describe("Windows platform", () => {
    it("accepts valid absolute drive paths", () => {
      const res = resolveDataDir({
        envValue: "C:\\Users\\tester\\custom_data",
        product: "naukri",
        platform: "win32",
      });
      expect(res).toBe("C:\\Users\\tester\\custom_data");
    });

    it("rejects relative paths on Windows", () => {
      const relativePaths = ["custom_data", ".\\custom_data", "..\\data", "relative/path"];
      for (const envValue of relativePaths) {
        expect(
          () =>
            resolveDataDir({
              envValue,
              product: "naukri",
              platform: "win32",
            }),
          `Should reject relative path: ${envValue}`,
        ).toThrow(StoreError);
      }
    });

    it("rejects UNC and device paths on Windows", () => {
      const uncPaths = [
        "\\\\server\\share\\data",
        "//server/share/data",
        "\\\\?\\C:\\data",
        "//?/C:/data",
      ];
      for (const envValue of uncPaths) {
        expect(
          () =>
            resolveDataDir({
              envValue,
              product: "naukri",
              platform: "win32",
            }),
          `Should reject UNC path: ${envValue}`,
        ).toThrow(StoreError);
      }
    });

    it("rejects drive roots and system directories on Windows", () => {
      const systemRoots = [
        "C:\\",
        "C:",
        "c:/",
        "D:\\",
        "C:\\Windows",
        "C:\\Windows\\System32",
        "C:\\Program Files",
        "C:\\Program Files (x86)",
        "C:\\Program Files\\app",
      ];
      for (const envValue of systemRoots) {
        expect(
          () =>
            resolveDataDir({
              envValue,
              product: "naukri",
              platform: "win32",
            }),
          `Should reject system root: ${envValue}`,
        ).toThrow(StoreError);
      }
    });

    it("resolves default path using appData on Windows", () => {
      const res = resolveDataDir({
        product: "naukri",
        platform: "win32",
        appData: "C:\\Users\\tester\\AppData\\Roaming",
      });
      expect(res).toBe("C:\\Users\\tester\\AppData\\Roaming\\naukri");
    });

    it("resolves default path using home when appData is missing on Windows", () => {
      const res = resolveDataDir({
        product: "naukri",
        platform: "win32",
        home: "C:\\Users\\tester",
      });
      expect(res).toBe("C:\\Users\\tester\\AppData\\Roaming\\naukri");
    });

    it("throws INVALID_DATA_DIR when both appData and home are missing on Windows", () => {
      expect(() =>
        resolveDataDir({
          product: "naukri",
          platform: "win32",
        }),
      ).toThrow(StoreError);
    });
  });

  describe("macOS platform", () => {
    it("accepts valid absolute paths on macOS", () => {
      const res = resolveDataDir({
        envValue: "/Users/tester/custom_data",
        product: "indeed",
        platform: "darwin",
      });
      expect(res).toBe("/Users/tester/custom_data");
    });

    it("rejects relative paths on macOS", () => {
      expect(() =>
        resolveDataDir({
          envValue: "relative/dir",
          product: "indeed",
          platform: "darwin",
        }),
      ).toThrow(StoreError);
    });

    it("rejects system root and system directories on macOS", () => {
      const sysDirs = ["/", "/etc", "/usr", "/usr/bin", "/bin", "/System", "/sbin", "/var"];
      for (const envValue of sysDirs) {
        expect(
          () =>
            resolveDataDir({
              envValue,
              product: "indeed",
              platform: "darwin",
            }),
          `Should reject system dir: ${envValue}`,
        ).toThrow(StoreError);
      }
    });

    it("resolves default macOS path using home", () => {
      const res = resolveDataDir({
        product: "indeed",
        platform: "darwin",
        home: "/Users/tester",
      });
      expect(res).toBe("/Users/tester/Library/Application Support/indeed");
    });

    it("throws INVALID_DATA_DIR when home is missing on macOS", () => {
      expect(() =>
        resolveDataDir({
          product: "indeed",
          platform: "darwin",
        }),
      ).toThrow(StoreError);
    });
  });

  describe("Linux platform", () => {
    it("resolves default path using xdgDataHome on Linux", () => {
      const res = resolveDataDir({
        product: "naukri",
        platform: "linux",
        xdgDataHome: "/custom/share",
        home: "/home/tester",
      });
      expect(res).toBe("/custom/share/naukri");
    });

    it("resolves default path using home when xdgDataHome is missing on Linux", () => {
      const res = resolveDataDir({
        product: "naukri",
        platform: "linux",
        home: "/home/tester",
      });
      expect(res).toBe("/home/tester/.local/share/naukri");
    });

    it("throws INVALID_DATA_DIR when both xdgDataHome and home are missing on Linux", () => {
      expect(() =>
        resolveDataDir({
          product: "naukri",
          platform: "linux",
        }),
      ).toThrow(StoreError);
    });
  });
});
