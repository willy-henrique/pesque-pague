import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

function getDevSecret() {
  return process.env.DEV_PANEL_SECRET?.trim() || "willydev2025";
}

function authorize(request: Request): boolean {
  return request.headers.get("x-dev-token")?.trim() === getDevSecret();
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return Response.json({ error: "Token inválido." }, { status: 401 });
  }
  try {
    const snap = await getAdminDb()
      .collection("usuarios")
      .where("role", "==", "admin")
      .get();

    const admins = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        nome: data.nome as string,
        email: data.email as string,
        ativo: data.ativo ?? true,
        criadoEm: (data.criadoEm as { toDate?: () => Date } | null)?.toDate?.().toISOString() ?? null,
      };
    });

    admins.sort((a, b) =>
      (b.criadoEm ?? "").localeCompare(a.criadoEm ?? "")
    );

    return Response.json({ admins });
  } catch (err) {
    console.error("[GET /api/dev/admins]", err);
    return Response.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return Response.json({ error: "Token inválido." }, { status: 401 });
  }
  try {
    const body = (await request.json()) as { nome?: string; email?: string; senha?: string };
    const nome  = body.nome?.trim();
    const email = body.email?.trim().toLowerCase();
    const senha = body.senha ?? "";

    if (!nome)                   return Response.json({ error: "Informe o nome."             }, { status: 400 });
    if (!email?.includes("@"))   return Response.json({ error: "E-mail inválido."            }, { status: 400 });
    if (senha.length < 6)        return Response.json({ error: "Senha mínima: 6 caracteres." }, { status: 400 });

    const auth = getAdminAuth();
    const db   = getAdminDb();

    const user = await auth.createUser({
      email,
      password: senha,
      displayName: nome,
      disabled: false,
    });

    await auth.setCustomUserClaims(user.uid, { role: "admin" });

    await db.collection("usuarios").doc(user.uid).set({
      nome,
      email,
      role: "admin",
      ativo: true,
      criadoEm: FieldValue.serverTimestamp(),
    });

    return Response.json({ ok: true, uid: user.uid });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "auth/email-already-exists") {
      return Response.json({ error: "E-mail já está em uso." }, { status: 409 });
    }
    console.error("[POST /api/dev/admins]", err);
    return Response.json({ error: "Erro ao criar administrador." }, { status: 500 });
  }
}
