import { describe, it, expect } from "vitest";
import { renderPrompt } from "../prompt-renderer";
import type { Issue } from "@symphony/shared";

const mockIssue: Issue = {
  id: "issue-1",
  identifier: "PROJ-42",
  title: "Fix the bug",
  description: "Description text",
  priority: 2,
  state: "In Progress",
  branchName: "fix/proj-42",
  url: "https://linear.app/proj/issue/PROJ-42",
  labels: ["backend", "urgent"],
  blockedBy: [
    { id: "b1", identifier: "PROJ-10", state: "Done" },
    { id: "b2", identifier: "PROJ-20", state: "In Progress" },
  ],
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-02T00:00:00Z",
};

describe("renderPrompt", () => {
  it("renders issue fields into template (e.g., identifier and title)", async () => {
    const template = "{{ issue.identifier }}: {{ issue.title }}";
    const result = await renderPrompt(template, mockIssue, null);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("PROJ-42: Fix the bug");
    }
  });

  it("renders attempt variable (null on first run shows empty/nothing)", async () => {
    const template = "Attempt: {{ attempt }}";
    const result = await renderPrompt(template, mockIssue, null);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("Attempt: ");
    }
  });

  it("renders attempt as integer on retry", async () => {
    const template = "Attempt: {{ attempt }}";
    const result = await renderPrompt(template, mockIssue, 2);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("Attempt: 2");
    }
  });

  it("renders nested arrays - labels with for loop", async () => {
    const template =
      "{% for label in issue.labels %}{{ label }}{% endfor %}";
    const result = await renderPrompt(template, mockIssue, null);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("backendurgent");
    }
  });

  it("renders blockers with for loop", async () => {
    const template =
      "{% for b in issue.blockedBy %}{{ b.identifier }}{% endfor %}";
    const result = await renderPrompt(template, mockIssue, null);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("PROJ-10PROJ-20");
    }
  });

  it("fails on unknown variable with template_render_error", async () => {
    const template = "{{ nonexistent }}";
    const result = await renderPrompt(template, mockIssue, null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("template_render_error");
      expect(result.error.message).toBeDefined();
    }
  });

  it("fails on unknown filter with template_render_error", async () => {
    const template = "{{ issue.title | nonexistent }}";
    const result = await renderPrompt(template, mockIssue, null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("template_render_error");
      expect(result.error.message).toBeDefined();
    }
  });

  it("returns fallback prompt when template is empty string", async () => {
    const result = await renderPrompt("", mockIssue, null);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("You are working on an issue from Linear.");
    }
  });

  it("returns fallback prompt when template is whitespace only", async () => {
    const result = await renderPrompt("   \n\t  ", mockIssue, null);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("You are working on an issue from Linear.");
    }
  });
});
