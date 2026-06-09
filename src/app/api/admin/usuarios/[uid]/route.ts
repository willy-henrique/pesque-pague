import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { parseJsonBody, verifyAdminRequest } from "@/lib/api-auth";

export const runtime = "nodejs";

interface PatchBody {
  ativo?: boolean;
  senha?: string;
  setores?: string[];
  nome?: string;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ uid: string }> }
) {
  try {
    await verifyAdminRequest(request);
  } catch (res) {
    return res as Response;
  }

  try {
    const { uid } = await context.params;
    const body    = await parseJsonBody<PatchBody>(request);

    const db   = getAdminDb();
    const auth = getAdminAuth();

    const snap = await db.collection("usuarios").doc(uid).get();
    if (!snap.exists) {
      return Response.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    const role = snap.data()?.role as string;
    if (role !== "admin" && role !== "atendente") {
      return Response.json({ error: "Operação não permitida para este perfil." }, { status: 403 });
    }

    const updates: Record<string, unknown> = {};

    if (typeof body.ativo === "boolean") {
      updates.ativo = body.ativo;
      await auth.updateUser(uid, { disabled: !body.ativo });
    }

    if (body.senha !== undefined) {
      if (body.senha.length < 6) {
        return Response.json({ error: "Senha mínima: 6 caracteres." }, { status: 400 });
      }
      await auth.updateUser(uid, { password: body.senha });
    }

    if (body.nome?.trim()) {
      updates.nome = body.nome.trim();
      await auth.updateUser(uid, { displayName: body.nome.trim() });
    }

    if (role === "atendente" && Array.isArray(body.setores)) {
      const setores = body.setores.filter((s) => s === "cozinha" || s === "bar");
      if (setores.length > 0) updates.setores = setores;
    }

    if (Object.keys(updates).length > 0) {
      await db.collection("usuarios").doc(uid).update(updates);
    }

    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[PATCH /api/admin/usuarios/[uid]]", err);
    return Response.json({ error: "Falha ao atualizar usuário." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ uid: string }> }
) {
  try {
    await verifyAdminRequest(request);
  } catch (res) {
    return res as Response;
  }

  try {
    const { uid } = await context.params;
    const db      = getAdminDb();

    const snap = await db.collection("usuarios").doc(uid).get();
    if (!snap.exists) {
      return Response.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    const role = snap.data()?.role as string;
    if (role !== "admin" && role !== "atendente") {
      return Response.json({ error: "Operação não permitida para este perfil." }, { status: 403 });
    }

    await getAdminAuth().deleteUser(uid);
    await db.collection("usuarios").doc(uid).delete();

    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[DELETE /api/admin/usuarios/[uid]]", err);
    return Response.json({ error: "Falha ao remover usuário." }, { status: 500 });
  }
}
