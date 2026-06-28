import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, "..", "..", "packages", "components");
const srcRoot = path.join(packageRoot, "src");
const distRoot = path.join(packageRoot, "dist");

await mkdir(path.join(distRoot, "llm"), { recursive: true });
await cp(
  path.join(srcRoot, "llm", "model-catalog.json"),
  path.join(distRoot, "llm", "model-catalog.json"),
);
