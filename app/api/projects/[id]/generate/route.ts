import { errorResponse, generateVersion, jsonResponse, resolveOwner } from "../../../../../lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const owner = await resolveOwner(request);
  try {
    const { id } = await context.params;
    const payload = await request.json();
    const project = await generateVersion(owner.ownerKey, id, payload as { prompt?: unknown; requestId?: unknown; baseVersionId?: unknown });
    return jsonResponse({ data: project, error: null }, 202, owner.setCookie);
  } catch (error) {
    return errorResponse(error, owner.setCookie);
  }
}
