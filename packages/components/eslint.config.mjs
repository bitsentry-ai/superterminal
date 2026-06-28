import { createPackageConfig } from "../../scripts/eslint/create-config.mjs";

export default createPackageConfig({
  react: true,
  extraRules: {
    "react-refresh/only-export-components": "off",
  },
  tsconfigRootDir: import.meta.dirname,
});
