import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

function getDevSecret() {
  return process.env.DEV_PANEL_SECRET?.trim() || "willydev2025";
}

function authorize(request: Request): boolean {
  return request.headers.get("x-dev-token")?.trim() === getDevSecret();
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ uid: string }> }
) {
  if (!authorize(request)) {
    return Response.json({ error: "Token inválido." }, { status: 401 });
  }
  try {
    const { uid }  = await context.params;
    const body     = (await request.json()) as { ativo?: boolean; senha?: string };

    const auth = getAdminAuth();
    const db   = getAdminDb();

    const snap = await db.collection("usuarios").doc(uid).get();
    if (!snap.exists || snap.data()?.role !== "admin") {
      return Response.json({ error: "Administrador não encontrado." }, { status: 404 });
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

    if (Object.keys(updates).length > 0) {
      await db.collection("usuarios").doc(uid).update(updates);
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/dev/admins/[uid]]", err);
    return Response.json({ error: "Erro ao atualizar." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ uid: string }> }
) {
  if (!authorize(request)) {
    return Response.json({ error: "Token inválido." }, { status: 401 });
  }
  try {
    const { uid } = await context.params;

    const db   = getAdminDb();
    const snap = await db.collection("usuarios").doc(uid).get();
    if (!snap.exists || snap.data()?.role !== "admin") {
      return Response.json({ error: "Administrador não encontrado." }, { status: 404 });
    }

    await getAdminAuth().deleteUser(uid);
    await db.collection("usuarios").doc(uid).delete();

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/dev/admins/[uid]]", err);
    return Response.json({ error: "Erro ao remover." }, { status: 500 });
  }
}
