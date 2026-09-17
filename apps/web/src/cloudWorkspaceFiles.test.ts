import { describe, expect, it } from "vitest";

import { cloudWorkspaceFilePath } from "./cloudWorkspaceFiles";

describe("cloudWorkspaceFilePath", () => {
  it("keeps directory separators while encoding individual file segments", () => {
    expect(cloudWorkspaceFilePath("workspace-id", "/src/a file.ts")).toBe(
      "/v1/workspaces/workspace-id/files/src/a%20file.ts",
    );
  });

  it("rejects relative and traversal file paths", () => {
    expect(() => cloudWorkspaceFilePath("workspace-id", "src/index.ts")).toThrow("start");
    expect(() => cloudWorkspaceFilePath("workspace-id", "/src/../secret")).toThrow("invalid");
    expect(() => cloudWorkspaceFilePath("workspace-id", "/src/unsafe\u0000.ts")).toThrow(
      "control characters",
    );
  });
});
