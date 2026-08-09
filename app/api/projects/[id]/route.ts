import { errorResponse, getProject, jsonResponse, resolveOwner } from "../../../../lib/store";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const owner = await resolveOwner(request);
  try {
    const { id } = await context.params;
    const project = await getProject(owner.ownerKey, id);
    return jsonResponse({ data: project, error: null }, 200, owner.setCookie);
  } catch (error) {
    return errorResponse(error, owner.setCookie);
  }
}
