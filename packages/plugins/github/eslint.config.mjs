import { createPackageConfig } from "../../../scripts/eslint/create-config.mjs";

export default createPackageConfig({
  tsconfigRootDir: import.meta.dirname,
  extraRules: {
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unsafe-assignment": "off",
    "@typescript-eslint/no-unsafe-member-access": "off",
    "@typescript-eslint/no-unsafe-call": "off",
    "@typescript-eslint/no-unsafe-argument": "off",
    "@typescript-eslint/no-unsafe-return": "off",
    "@typescript-eslint/no-unnecessary-boolean-literal-compare": "off",
    "@typescript-eslint/no-useless-default-assignment": "off",
    "@typescript-eslint/no-unnecessary-type-conversion": "off",
    "@typescript-eslint/require-await": "off",
    "@typescript-eslint/restrict-plus-operands": "off",
    "@typescript-eslint/restrict-template-expressions": "off",
    "no-ternary": "off",
    "unicorn/no-useless-undefined": "off",
  },
});
