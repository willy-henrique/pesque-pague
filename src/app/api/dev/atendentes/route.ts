import { getAdminDb } from "@/lib/firebase-admin";
import { verifyDevRequest } from "@/lib/dev-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await verifyDevRequest(request);
  } catch (res) {
    return res as Response;
  }

  try {
    const snap = await getAdminDb()
      .collection("usuarios")
      .where("role", "==", "atendente")
      .get();

    const atendentes = snap.docs.map((d) => {
      const data = d.data();
      return {
        id:        d.id,
        nome:      data.nome      as string,
        email:     data.email     as string,
        ativo:     data.ativo     ?? true,
        setores:   data.setores   ?? ["cozinha", "bar"],
        criadoEm: (data.criadoEm as { toDate?: () => Date } | null)?.toDate?.().toISOString() ?? null,
      };
    });

    atendentes.sort((a, b) => (b.criadoEm ?? "").localeCompare(a.criadoEm ?? ""));

    return Response.json({ atendentes });
  } catch (err) {
    console.error("[GET /api/dev/atendentes]", err);
    return Response.json({ error: "Erro interno." }, { status: 500 });
  }
}
