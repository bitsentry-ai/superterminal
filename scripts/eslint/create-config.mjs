import js from "@eslint/js";
import sonarjs from "eslint-plugin-sonarjs";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import unicorn from "eslint-plugin-unicorn";
import tseslint from "typescript-eslint";

const sharedIgnores = [
  "**/node_modules/**",
  "**/.turbo/**",
  "**/.cache/**",
  "**/coverage/**",
  "**/dist/**",
  "**/build/**",
  "**/out/**",
  "**/release/**",
  "**/playwright-report/**",
  "**/.generated-trpc-types/**",
  "**/src/@generated/**",
  "**/*.d.ts",
];

export const sharedStyleRules = {
  eqeqeq: ["error", "always", { null: "ignore" }],
  "no-var": "error",
};

export const sharedTypeScriptRules = {
  ...sharedStyleRules,
  "@typescript-eslint/no-require-imports": "off",
  "no-empty": "off",
  "no-case-declarations": "off",
  "no-unused-vars": "off",
  "no-useless-catch": "off",
  "no-useless-assignment": "off",
  "no-useless-escape": "off",
  "prefer-const": "off",
  "preserve-caught-error": "off",
  "@typescript-eslint/no-empty-object-type": "off",
  "@typescript-eslint/no-unused-vars": "off",
  "require-yield": "off",
  "@typescript-eslint/no-explicit-any": [
    "error",
    {
      fixToUnknown: true,
      ignoreRestArgs: false,
    },
  ],
  "@typescript-eslint/no-unsafe-assignment": "error",
  "@typescript-eslint/no-unsafe-member-access": "error",
  "@typescript-eslint/no-unsafe-call": "error",
  "@typescript-eslint/no-unsafe-argument": "error",
  "@typescript-eslint/no-unsafe-return": "error",
  "@typescript-eslint/no-unnecessary-type-assertion": "error",
  "@typescript-eslint/consistent-type-assertions": [
    "error",
    {
      assertionStyle: "as",
      objectLiteralTypeAssertions: "never",
    },
  ],
  "@typescript-eslint/no-unnecessary-condition": "off",
  "@typescript-eslint/strict-boolean-expressions": "off",
  complexity: ["warn", 60],
  "no-ternary": "error",
  "no-nested-ternary": "error",
  "no-unneeded-ternary": "error",
  "no-restricted-syntax": [
    "error",
    {
      selector:
        "TSAsExpression > TSAsExpression, TSTypeAssertion > TSTypeAssertion",
      message:
        "Do not use double assertions. Validate or narrow the value instead.",
    },
  ],
  "sonarjs/cognitive-complexity": ["warn", 30],
  "sonarjs/no-collapsible-if": "warn",
  "sonarjs/no-duplicated-branches": "warn",
  "sonarjs/no-identical-functions": "error",
  "sonarjs/prefer-single-boolean-return": "warn",
  "unicorn/filename-case": "off",
  "unicorn/no-nested-ternary": "error",
  "unicorn/no-null": "off",
  "unicorn/no-useless-undefined": "warn",
  "unicorn/prefer-optional-catch-binding": "warn",
  "unicorn/prevent-abbreviations": "off",
};

const sharedGlobals = {
  ...globals.browser,
  ...globals.node,
  ...globals.jest,
};

export function createPackageConfig({
  ignores = [],
  react = false,
  extraRules = {},
  tsconfigRootDir,
} = {}) {
  const reactRules = react
    ? {
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
        "react-refresh/only-export-components": [
          "warn",
          { allowConstantExport: true },
        ],
      }
    : {};

  return tseslint.config(
    { ignores: [...sharedIgnores, ...ignores] },
    {
      extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked],
      files: ["**/*.{ts,tsx,mts,cts}"],
      languageOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        globals: sharedGlobals,
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
      plugins: {
        sonarjs,
        unicorn,
        ...(react
          ? {
              "react-hooks": reactHooks,
              "react-refresh": reactRefresh,
            }
          : {}),
      },
      rules: {
        ...sharedTypeScriptRules,
        ...reactRules,
        ...extraRules,
      },
    },
  );
}
