import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { verifyDevRequest } from "@/lib/dev-auth";
import { writeLog } from "@/lib/dev-log";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ uid: string }> }
) {
  let ator = "dev";
  try {
    const ctx = await verifyDevRequest(request);
    ator = ctx.email;
  } catch (res) {
    return res as Response;
  }

  try {
    const { uid } = await context.params;
    const body    = (await request.json()) as { ativo?: boolean; senha?: string };

    const auth = getAdminAuth();
    const db   = getAdminDb();

    const snap = await db.collection("usuarios").doc(uid).get();
    if (!snap.exists || snap.data()?.role !== "admin") {
      return Response.json({ error: "Administrador não encontrado." }, { status: 404 });
    }

    const adminEmail = snap.data()?.email as string;
    const updates: Record<string, unknown> = {};

    if (typeof body.ativo === "boolean") {
      updates.ativo = body.ativo;
      await auth.updateUser(uid, { disabled: !body.ativo });
      await writeLog(
        body.ativo ? "admin_ativado" : "admin_desativado",
        `Admin ${adminEmail} ${body.ativo ? "ativado" : "desativado"}.`,
        ator,
        { uid, email: adminEmail }
      );
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
  let ator = "dev";
  try {
    const ctx = await verifyDevRequest(request);
    ator = ctx.email;
  } catch (res) {
    return res as Response;
  }

  try {
    const { uid } = await context.params;
    const db      = getAdminDb();

    const snap = await db.collection("usuarios").doc(uid).get();
    if (!snap.exists || snap.data()?.role !== "admin") {
      return Response.json({ error: "Administrador não encontrado." }, { status: 404 });
    }

    const adminEmail = snap.data()?.email as string;

    await getAdminAuth().deleteUser(uid);
    await db.collection("usuarios").doc(uid).delete();

    await writeLog("admin_removido", `Admin ${adminEmail} removido permanentemente.`, ator, { uid, email: adminEmail });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/dev/admins/[uid]]", err);
    return Response.json({ error: "Erro ao remover." }, { status: 500 });
  }
}
