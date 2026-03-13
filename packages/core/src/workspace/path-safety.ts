import { resolve, normalize } from "node:path";

export function sanitizeIdentifier(identifier: string): string {
  return identifier.replace(/[^A-Za-z0-9._-]/g, "_");
}

export function isPathUnderRoot(
  workspacePath: string,
  rootPath: string
): boolean {
  const normalizedWorkspace = normalize(resolve(workspacePath));
  const normalizedRoot = normalize(resolve(rootPath));
  return (
    normalizedWorkspace.startsWith(normalizedRoot + "/") ||
    normalizedWorkspace === normalizedRoot
  );
}
