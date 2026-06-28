import { cp } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, "..", "..", "packages", "i18n");
const srcLocales = path.join(packageRoot, "src", "locales");
const distLocales = path.join(packageRoot, "dist", "locales");

await cp(srcLocales, distLocales, { recursive: true });
