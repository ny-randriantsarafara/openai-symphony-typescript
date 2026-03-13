import { Liquid } from "liquidjs";
import type { Issue, SymphonyError, Result } from "@symphony/shared";

const FALLBACK_PROMPT = "You are working on an issue from Linear.";

export async function renderPrompt(
  template: string,
  issue: Issue,
  attempt: number | null,
): Promise<Result<string, SymphonyError>> {
  if (template.trim() === "") {
    return { ok: true, value: FALLBACK_PROMPT };
  }

  const engine = new Liquid({
    strictVariables: true,
    strictFilters: true,
  });

  try {
    const rendered = await engine.parseAndRender(template, {
      issue,
      attempt,
    });
    return { ok: true, value: rendered };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: { kind: "template_render_error", variable: "", message },
    };
  }
}
