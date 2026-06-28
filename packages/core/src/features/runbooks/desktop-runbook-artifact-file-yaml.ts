import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

import {
  createDesktopRunbookArtifactFile,
} from "./desktop-runbook-artifact-file";

const artifactFile = createDesktopRunbookArtifactFile({
  parseYaml,
  stringifyYaml,
});

export const parseRunbookArtifactFile: typeof artifactFile.parseRunbookArtifactFile =
  (content) => artifactFile.parseRunbookArtifactFile(content);
export const serializeRunbookArtifactFile: typeof artifactFile.serializeRunbookArtifactFile =
  (artifact) => artifactFile.serializeRunbookArtifactFile(artifact);
