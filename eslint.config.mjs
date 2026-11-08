import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import sonarjs from "eslint-plugin-sonarjs";
import stylistic from "@stylistic/eslint-plugin";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  {
    plugins: {
      sonarjs,
      stylistic,
    },
    rules: {
      // Complexity
      complexity: ["warn", { max: 10 }],
      "sonarjs/cognitive-complexity": ["warn", 5],
      "max-depth": ["warn", 4],
      "max-params": ["warn", 4],
      "max-lines-per-function": [
        "warn",
        {
          max: 100,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      "max-statements": "off",

      // Readability
      curly: ["error", "all"],
      "one-var": ["error", "never"],
      "no-multi-assign": "error",
      "max-statements-per-line": ["error", { max: 1 }],
      "max-len": [
        "warn",
        {
          code: 120,
          ignoreComments: true,
          ignoreUrls: true,
          ignoreTemplateLiterals: true,
          ignoreStrings: true,
        },
      ],

      // Spacing
      "stylistic/padding-line-between-statements": [
        "warn",
        {
          blankLine: "always",
          prev: ["const", "let"],
          next: "*",
        },
        {
          blankLine: "any",
          prev: ["const", "let"],
          next: ["const", "let"],
        },
        {
          blankLine: "always",
          prev: "*",
          next: "return",
        },
        {
          blankLine: "always",
          prev: "expression",
          next: ["if", "for", "while", "do"],
        },
        {
          blankLine: "always",
          prev: "*",
          next: ["for", "while", "do"],
        },
        {
          blankLine: "always",
          prev: "if",
          next: "expression",
        },
      ],

      // "no-magic-numbers": [
      //   "warn",
      //   {
      //     ignore: [0, 1, -1],
      //     ignoreArrayIndexes: true,
      //   },
      // ],
    },
  },

  // Tests
  {
    files: ["**/*.test.ts", "**/*.test.mjs"],
    rules: {
      "max-lines-per-function": "off",
    },
  },

  // Node.js CLI, tests, and maintained scripts
  {
    files: ["src/**/*.ts", "test/**/*.{ts,mjs}", "scripts/**/*.{js,mjs,cjs,ts}"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        URL: "readonly",
        AbortController: "readonly",
        AbortSignal: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
      },
    },
  },

  // Generated output and installed dependencies are not maintained source.
  { ignores: ["dist/**", "node_modules/**"] },
);
