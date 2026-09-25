import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ["src/**/*.ts"],
    rules: {
      "no-console": "error",
    },
  },
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**"],
  },
);
