
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
      complexity: ["error", { max: 10 }],
      "sonarjs/cognitive-complexity": ["error", 5],
      "max-depth": ["error", 3],
      "max-params": ["error", 4],
      "max-lines-per-function": [
        "error",
        {
          max: 85,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      "max-statements": ["warn", 22],

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
        "error",
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

  // Node.js verification fixtures and maintained scripts
  {
    files: ["tests/**/*.ts", "tests/**/*.mjs", "scripts/**/*.{js,mjs,cjs,ts}"],
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

  // Browser fixture
  {
    files: [
      "src/main.ts",
    ],
    languageOptions: {
      globals: {
        window: "readonly",
      },
    },
  },

);
