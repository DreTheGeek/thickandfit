import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // These components legitimately sync BROWSER-ONLY state after mount: the local timezone, a
  // localStorage flag, push/iOS capability detection, and the hydration-safe `mounted` flag. None
  // of those values exist during SSR, so a post-mount setState in an effect is the correct pattern.
  // react-hooks/set-state-in-effect (a performance hint) overfires on it, so scope it off for
  // exactly these files. It stays ERROR everywhere else, where it correctly flags a genuinely
  // unnecessary effect (as it did for notification-bell, which was fixed to adjust state in render).
  {
    files: [
      "src/components/dashboard/today-screen.tsx",
      "src/components/exercises/exercise-browser.tsx",
      "src/components/notifications/push-opt-in.tsx",
      "src/components/pwa/ios-install-banner.tsx",
      "src/components/ui/theme-toggle.tsx",
    ],
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
  // Honor the `_`-prefix convention for intentionally-unused args/vars (already used across the
  // codebase, e.g. form-action `_prev`/`_formData` and unused defaults like `_locale`).
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
