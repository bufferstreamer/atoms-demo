import { activateVersion, errorResponse, jsonResponse, resolveOwner } from "../../../../../../../lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string; versionId: string }> }) {
  const owner = await resolveOwner(request);
  try {
    const { id, versionId } = await context.params;
    const payload = (await request.json()) as { expectedCurrentVersionId?: unknown };
    const project = await activateVersion(owner.ownerKey, id, versionId, payload.expectedCurrentVersionId);
    return jsonResponse({ data: project, error: null }, 200, owner.setCookie);
  } catch (error) {
    return errorResponse(error, owner.setCookie);
  }
}
