import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { parseJsonBody, verifyAdminRequest } from "@/lib/api-auth";

export const runtime = "nodejs";

interface PatchAtendenteBody {
  ativo?: boolean;
  senha?: string;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ uid: string }> }
) {
  try {
    await verifyAdminRequest(request);
    const { uid } = await context.params;
    const body = await parseJsonBody<PatchAtendenteBody>(request);

    const db = getAdminDb();
    const ref = db.collection("usuarios").doc(uid);
    const snap = await ref.get();

    if (!snap.exists || snap.data()?.role !== "atendente") {
      return Response.json({ error: "Atendente não encontrado." }, { status: 404 });
    }

    const auth = getAdminAuth();
    const updates: Record<string, unknown> = {};

    if (typeof body.ativo === "boolean") {
      updates.ativo = body.ativo;
      await auth.updateUser(uid, { disabled: !body.ativo });
    }

    if (body.senha !== undefined) {
      if (body.senha.length < 6) {
        return Response.json({ error: "A senha deve ter no mínimo 6 caracteres." }, { status: 400 });
      }
      await auth.updateUser(uid, { password: body.senha });
    }

    if (Object.keys(updates).length > 0) {
      await ref.update(updates);
    }

    return Response.json({
      ok: true,
      message: body.ativo === false ? "Atendente bloqueado." : "Atendente atualizado.",
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[PATCH /api/admin/atendentes/[uid]]", err);
    return Response.json({ error: "Falha ao atualizar atendente." }, { status: 500 });
  }
}
