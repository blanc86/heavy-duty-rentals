import js from "@eslint/js";
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";

export default tseslint.config(
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "db/migrations/**",
      "playwright-report/**",
      "test-results/**",
      "storage/**",
      "next-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      // `any` erases exactly the guarantees this codebase relies on around
      // money, authorization and booking state. It is an error, not a warning.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-restricted-globals": [
        "error",
        { name: "parseFloat", message: "Money is integer halalas. Never parse money as a float." },
      ],
    },
  },
  {
    // Node scripts and tests run outside the browser, so the default globals
    // do not apply. Declared explicitly rather than pulling in another
    // dependency just to name them.
    files: ["scripts/**/*.mjs", "tests/**/*.ts", "*.config.{ts,mjs}", "src/proxy.ts"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        crypto: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        URL: "readonly",
        AbortController: "readonly",
        __dirname: "readonly",
      },
    },
    rules: {
      "no-console": "off",
      // Scripts are plain JS; the TS rules do not apply to them.
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
