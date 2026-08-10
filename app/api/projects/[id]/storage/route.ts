import { InputError } from "../../../../../lib/generator";
import { handleStorage, jsonResponse, resolveOwner } from "../../../../../lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const owner = await resolveOwner(request);
  try {
    const { id } = await context.params;
    const data = await handleStorage(owner.ownerKey, id, await request.json());
    return jsonResponse({ ok: true, data }, 200, owner.setCookie);
  } catch (error) {
    const known = error instanceof InputError;
    return jsonResponse({ ok: false, error: { code: known ? error.code : "PERSISTENCE_ERROR", message: known ? error.message : "状态服务暂时不可用。" } }, known ? error.status : 500, owner.setCookie);
  }
}
