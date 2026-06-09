import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyDevRequest } from "@/lib/dev-auth";

export const runtime = "nodejs";

function isBrasiliaToday(date: Date): boolean {
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
  };
  const todayStr = new Date().toLocaleDateString("pt-BR", opts);
  return date.toLocaleDateString("pt-BR", opts) === todayStr;
}

export async function GET(request: Request) {
  try {
    await verifyDevRequest(request);
  } catch (res) {
    return res as Response;
  }

  try {
    const db       = getAdminDb();
    const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const [pedidosSnap, usuariosSnap, piquesSnap, logsSnap] = await Promise.all([
      db.collection("pedidos")
        .where("criadoEm", ">=", Timestamp.fromDate(since48h))
        .get(),
      db.collection("usuarios").get(),
      db.collection("piques").get(),
      db.collection("logs")
        .orderBy("criadoEm", "desc")
        .limit(5)
        .get(),
    ]);

    const hojeAll = pedidosSnap.docs.filter((d) => {
      const t = (d.data().criadoEm as { toDate?: () => Date } | null)?.toDate?.();
      return t ? isBrasiliaToday(t) : false;
    });

    const receitaHoje = hojeAll
      .filter((d) => d.data().status === "pago")
      .reduce((s, d) => s + ((d.data().total as number) ?? 0), 0);

    const taxaHoje = hojeAll
      .filter((d) => d.data().status === "pago")
      .reduce((s, d) => s + ((d.data().taxaServico as number) ?? 0), 0);

    const pedidosAtivos = pedidosSnap.docs.filter(
      (d) => !["pago", "cancelado"].includes(d.data().status as string)
    );

    const usuarios  = usuariosSnap.docs.map((d) => d.data());
    const piques    = piquesSnap.docs.map((d) => d.data());

    const recentLogs = logsSnap.docs.map((d) => {
      const data = d.data();
      return {
        id:        d.id,
        tipo:      data.tipo,
        mensagem:  data.mensagem,
        ator:      data.ator,
        criadoEm: (data.criadoEm as { toDate?: () => Date } | null)?.toDate?.().toISOString() ?? null,
      };
    });

    return Response.json({
      pedidosHoje:    hojeAll.length,
      receitaHoje,
      taxaHoje,
      pedidosAtivos:  pedidosAtivos.length,
      admins:         usuarios.filter((u) => u.role === "admin").length,
      atendentes:     usuarios.filter((u) => u.role === "atendente").length,
      piquesTotal:    piques.filter((p) => p.ativo !== false).length,
      piquesOcupados: piques.filter((p) => p.status === "ocupado").length,
      recentLogs,
    });
  } catch (err) {
    console.error("[GET /api/dev/stats]", err);
    return Response.json({ error: "Erro interno." }, { status: 500 });
  }
}
