import { createProject, errorResponse, jsonResponse, resolveOwner } from "../../../lib/store";

export async function POST(request: Request) {
  const owner = await resolveOwner(request);
  try {
    const payload = await request.json();
    const project = await createProject(owner.ownerKey, payload as { prompt?: unknown; requestId?: unknown });
    return jsonResponse({ data: project, error: null }, 201, owner.setCookie);
  } catch (error) {
    return errorResponse(error, owner.setCookie);
  }
}
