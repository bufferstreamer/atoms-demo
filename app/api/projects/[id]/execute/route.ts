import { getRequestExecutionContext } from "vinext/shims/request-context";
import { InputError } from "../../../../../lib/generator";
import { errorResponse, executeGeneration, finalizeDeadlineAudit, getProject, jsonResponse, resolveOwner } from "../../../../../lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const owner = await resolveOwner(request);
  try {
    const { id } = await context.params;
    const payload = await request.json();
    const requestId = typeof (payload as { requestId?: unknown }).requestId === "string" ? (payload as { requestId: string }).requestId : "";
    const executionContext = getRequestExecutionContext();
    const local = ["localhost", "127.0.0.1"].includes(new URL(request.url).hostname);
    if (!executionContext && !local) throw new InputError("BACKGROUND_TASKS_UNAVAILABLE", "后台任务能力暂不可用，请稍后重试。", 503);
    const startedEpoch = Date.now();
    const operation = executeGeneration(owner.ownerKey, id, { requestId });
    const audit = operation.then(
      () => finalizeDeadlineAudit(owner.ownerKey, id, requestId, startedEpoch),
      () => finalizeDeadlineAudit(owner.ownerKey, id, requestId, startedEpoch),
    );
    if (executionContext) executionContext.waitUntil(audit.catch(() => undefined));
    else void audit.catch(() => undefined);
    const pending = Symbol("pending");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const result = await Promise.race([
      operation,
      new Promise<typeof pending>((resolve) => { timer = setTimeout(() => resolve(pending), 64_500); }),
    ]);
    if (timer) clearTimeout(timer);
    if (result === pending) {
      if (executionContext) executionContext.waitUntil(operation.catch(() => undefined));
      else void operation.catch(() => undefined);
      const project = await getProject(owner.ownerKey, id, false);
      if (project.status !== "BUILDING") return jsonResponse({ data: project, error: null }, 200, owner.setCookie);
      return jsonResponse({ project, run: { id: project.latestRunId, publicStatus: "FINALIZING" }, retryAfterMs: 500 }, 202, owner.setCookie);
    }
    const project = result;
    return jsonResponse({ data: project, error: null }, 200, owner.setCookie);
  } catch (error) {
    return errorResponse(error, owner.setCookie);
  }
}
