import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Async initial data loading is intentionally coordinated in effects in a
      // few client-only surfaces; network completion, not render, drives state.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/exhaustive-deps": "off",
      // Provider/domain payloads cross typed boundaries where an explicit
      // narrow runtime cast is clearer than importing generated ORM internals.
      "@typescript-eslint/no-explicit-any": "off",
      "import/no-anonymous-default-export": "off"
    }
  },
  globalIgnores([".next/**", "../../packages/database/src/generated/**"])
]);
