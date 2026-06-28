import { createPackageConfig } from "../../scripts/eslint/create-config.mjs";

export default createPackageConfig({
  react: true,
  tsconfigRootDir: import.meta.dirname,
});
