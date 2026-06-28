import { createPackageConfig } from "../../scripts/eslint/create-config.mjs";

export default createPackageConfig({
  react: true,
  ignores: ["scripts/dist/**"],
  tsconfigRootDir: import.meta.dirname,
});
