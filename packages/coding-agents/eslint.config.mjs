import { createPackageConfig } from "../../scripts/eslint/create-config.mjs";

export default createPackageConfig({
  tsconfigRootDir: import.meta.dirname,
});
