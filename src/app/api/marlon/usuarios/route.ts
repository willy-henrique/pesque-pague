import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { verifyMarlonRequest } from "@/lib/marlon-auth";
import type { AdminPermissao } from "@/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try { await verifyMarlonRequest(request); } catch (r) { return r as Response; }

  try {
    const snap = await getAdminDb()
      .collection("usuarios")
      .where("role", "in", ["admin", "atendente"])
      .get();

    const usuarios = snap.docs.map((d) => {
      const data = d.data();
      return {
        id:          d.id,
        nome:        data.nome        as string,
        email:       data.email       as string,
        role:        data.role        as string,
        ativo:       data.ativo       ?? true,
        setores:     data.setores     ?? [],
        permissoes:  data.permissoes  ?? [],
        criadoEm:   (data.criadoEm as { toDate?: () => Date } | null)?.toDate?.().toISOString() ?? null,
      };
    }).sort((a, b) => (b.criadoEm ?? "").localeCompare(a.criadoEm ?? ""));

    return Response.json({ usuarios });
  } catch (err) {
    console.error("[GET /api/marlon/usuarios]", err);
    return Response.json({ error: "Erro interno." }, { status: 500 });
  }
}

interface CreateBody {
  nome?: string; email?: string; senha?: string;
  role?: string; setores?: string[]; permissoes?: AdminPermissao[];
}

export async function POST(request: Request) {
  try { await verifyMarlonRequest(request); } catch (r) { return r as Response; }

  try {
    const body      = (await request.json()) as CreateBody;
    const nome      = body.nome?.trim();
    const email     = body.email?.trim().toLowerCase();
    const senha     = body.senha ?? "";
    const role      = body.role === "admin" ? "admin" : "atendente";
    const setores   = role === "atendente"
      ? (Array.isArray(body.setores) ? body.setores.filter((s) => s === "cozinha" || s === "bar") : ["cozinha", "bar"])
      : [];
    const permissoes: AdminPermissao[] = role === "admin" && Array.isArray(body.permissoes)
      ? body.permissoes
      : [];

    if (!nome)                 return Response.json({ error: "Informe o nome."             }, { status: 400 });
    if (!email?.includes("@")) return Response.json({ error: "E-mail inválido."            }, { status: 400 });
    if (senha.length < 6)      return Response.json({ error: "Senha mínima: 6 caracteres." }, { status: 400 });

    const auth = getAdminAuth();
    const db   = getAdminDb();

    const user = await auth.createUser({ email, password: senha, displayName: nome, disabled: false });
    await auth.setCustomUserClaims(user.uid, { role });

    const docData: Record<string, unknown> = {
      nome, email, role, ativo: true, criadoEm: FieldValue.serverTimestamp(),
    };
    if (role === "atendente") docData.setores     = setores;
    if (role === "admin")     docData.permissoes  = permissoes;

    await db.collection("usuarios").doc(user.uid).set(docData);
    return Response.json({ ok: true, uid: user.uid });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "auth/email-already-exists") {
      return Response.json({ error: "E-mail já está em uso." }, { status: 409 });
    }
    console.error("[POST /api/marlon/usuarios]", err);
    return Response.json({ error: "Erro ao criar usuário." }, { status: 500 });
  }
}
