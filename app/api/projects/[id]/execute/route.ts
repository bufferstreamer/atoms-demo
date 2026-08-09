import { errorResponse, executeGeneration, jsonResponse, resolveOwner } from "../../../../../lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const owner = await resolveOwner(request);
  try {
    const { id } = await context.params;
    const payload = await request.json();
    const project = await executeGeneration(owner.ownerKey, id, payload as { requestId?: unknown });
    return jsonResponse({ data: project, error: null }, 200, owner.setCookie);
  } catch (error) {
    return errorResponse(error, owner.setCookie);
  }
}
