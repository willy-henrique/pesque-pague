import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyDevRequest } from "@/lib/dev-auth";
import type { LogTipo } from "@/lib/dev-log";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await verifyDevRequest(request);
  } catch (res) {
    return res as Response;
  }

  try {
    const url    = new URL(request.url);
    const limit  = Math.min(parseInt(url.searchParams.get("limit") ?? "100"), 200);

    const snap = await getAdminDb()
      .collection("logs")
      .orderBy("criadoEm", "desc")
      .limit(limit)
      .get();

    const logs = snap.docs.map((d) => {
      const data = d.data();
      return {
        id:        d.id,
        tipo:      data.tipo      as LogTipo,
        mensagem:  data.mensagem  as string,
        ator:      data.ator      as string,
        metadata:  data.metadata  as Record<string, unknown>,
        criadoEm: (data.criadoEm as { toDate?: () => Date } | null)?.toDate?.().toISOString() ?? null,
      };
    });

    return Response.json({ logs });
  } catch (err) {
    console.error("[GET /api/dev/logs]", err);
    return Response.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await verifyDevRequest(request);
  } catch (res) {
    return res as Response;
  }

  try {
    const body = (await request.json()) as { tipo?: string; mensagem?: string; ator?: string; metadata?: Record<string, unknown> };

    if (!body.mensagem) {
      return Response.json({ error: "mensagem é obrigatória." }, { status: 400 });
    }

    await getAdminDb().collection("logs").add({
      tipo:      body.tipo     ?? "info",
      mensagem:  body.mensagem,
      ator:      body.ator     ?? "dev",
      metadata:  body.metadata ?? {},
      criadoEm:  FieldValue.serverTimestamp(),
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/dev/logs]", err);
    return Response.json({ error: "Erro interno." }, { status: 500 });
  }
}
