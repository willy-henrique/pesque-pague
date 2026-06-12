import { getAdminDb } from "@/lib/firebase-admin";
import { verifyDevRequest } from "@/lib/dev-auth";
import { writeLog } from "@/lib/dev-log";

export const runtime = "nodejs";

/* Deletes all documents in a collection in batches of 400 */
async function deleteCollection(collectionPath: string): Promise<number> {
  const db   = getAdminDb();
  let total  = 0;

  while (true) {
    const snap = await db.collection(collectionPath).limit(400).get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.docs.length;
  }

  return total;
}

export async function POST(request: Request) {
  let ator = "dev";
  try {
    const ctx = await verifyDevRequest(request);
    ator = ctx.email;
  } catch (res) {
    return res as Response;
  }

  try {
    const body = (await request.json()) as { confirmacao?: string };

    // Require explicit confirmation payload to avoid accidental calls
    if (body.confirmacao !== "LIMPAR") {
      return Response.json({ error: "Confirmação inválida. Envie { confirmacao: 'LIMPAR' }." }, { status: 400 });
    }

    const db = getAdminDb();

    // 1. Delete transactional collections
    const [pedidos, fechamentos, logs] = await Promise.all([
      deleteCollection("pedidos"),
      deleteCollection("fechamentos"),
      deleteCollection("logs"),
    ]);

    // 2. Reset all piques status to "livre"
    const piquesSnap = await db.collection("piques").get();
    if (!piquesSnap.empty) {
      const batch = db.batch();
      piquesSnap.docs.forEach((d) => batch.update(d.ref, { status: "livre" }));
      await batch.commit();
    }

    // 3. Write a final reset log (after clearing)
    await writeLog(
      "info",
      `Sistema limpo por ${ator}. Removidos: ${pedidos} pedidos, ${fechamentos} fechamentos, ${logs} logs. ${piquesSnap.size} mesas resetadas.`,
      ator,
    );

    return Response.json({
      ok: true,
      removidos: { pedidos, fechamentos, logs },
      mesasResetadas: piquesSnap.size,
    });
  } catch (err) {
    console.error("[POST /api/dev/reset]", err);
    return Response.json({ error: "Erro ao limpar o sistema." }, { status: 500 });
  }
}
