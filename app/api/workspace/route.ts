import { errorResponse, getWorkspace, jsonResponse, resolveOwner } from "../../../lib/store";

export async function GET(request: Request) {
  const owner = await resolveOwner(request);
  try {
    const workspace = await getWorkspace(owner.ownerKey);
    return jsonResponse({ data: workspace, error: null }, 200, owner.setCookie);
  } catch (error) {
    return errorResponse(error, owner.setCookie);
  }
}
