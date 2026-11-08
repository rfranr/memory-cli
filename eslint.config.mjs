import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import sonarjs from "eslint-plugin-sonarjs";

const files = ["src/**/*.ts", "test/**/*.ts", "scripts/**/*.mjs", "*.{mjs,cjs}"];

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", ".pi/**", ".agentic-adoption/**", "coverage/**"] },
  {
    files,
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        fetch: "readonly",
        AbortController: "readonly",
        AbortSignal: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
      },
    },
    plugins: { sonarjs },
    rules: {
      complexity: ["warn", { max: 10 }],
      "sonarjs/cognitive-complexity": ["warn", 5],
      "max-depth": ["warn", 3],
      "max-params": ["warn", 4],
      "max-lines-per-function": ["warn", { max: 85, skipBlankLines: true, skipComments: true }],
      "max-statements": ["warn", 22],
      "max-len": [
        "warn",
        { code: 120, ignoreComments: true, ignoreUrls: true, ignoreTemplateLiterals: true, ignoreStrings: true },
      ],
      curly: ["error", "all"],
      "one-var": ["error", "never"],
      "no-multi-assign": "error",
      "max-statements-per-line": ["error", { max: 1 }],
    },
  },
  { files: ["test/**/*.ts", "scripts/**/*.test.mjs"], rules: { "max-lines-per-function": "off" } },
);
