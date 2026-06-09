import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { parseJsonBody, verifyAdminRequest } from "@/lib/api-auth";

export const runtime = "nodejs";

interface CreateAtendenteBody {
  nome?: string;
  email?: string;
  senha?: string;
  setores?: string[];
}

export async function POST(request: Request) {
  try {
    await verifyAdminRequest(request);
    const body = await parseJsonBody<CreateAtendenteBody>(request);

    const nome = body.nome?.trim();
    const email = body.email?.trim().toLowerCase();
    const senha = body.senha ?? "";
    const setores = Array.isArray(body.setores) && body.setores.length > 0
      ? body.setores.filter((s) => s === "cozinha" || s === "bar")
      : ["cozinha", "bar"];

    if (!nome) {
      return Response.json({ error: "Informe o nome do atendente." }, { status: 400 });
    }
    if (!email || !email.includes("@")) {
      return Response.json({ error: "Informe um e-mail válido." }, { status: 400 });
    }
    if (senha.length < 6) {
      return Response.json({ error: "A senha deve ter no mínimo 6 caracteres." }, { status: 400 });
    }

    const auth = getAdminAuth();
    const db = getAdminDb();

    const user = await auth.createUser({
      email,
      password: senha,
      displayName: nome,
      disabled: false,
    });

    await auth.setCustomUserClaims(user.uid, { role: "atendente" });

    await db.collection("usuarios").doc(user.uid).set({
      nome,
      email,
      role: "atendente",
      ativo: true,
      setores,
      criadoEm: FieldValue.serverTimestamp(),
    });

    return Response.json({
      ok: true,
      uid: user.uid,
      message: "Atendente cadastrado com sucesso.",
    });
  } catch (err) {
    if (err instanceof Response) return err;

    const code = (err as { code?: string }).code;
    if (code === "auth/email-already-exists") {
      return Response.json({ error: "Este e-mail já está em uso." }, { status: 409 });
    }
    if (code === "auth/invalid-password") {
      return Response.json({ error: "Senha inválida." }, { status: 400 });
    }

    console.error("[POST /api/admin/atendentes]", err);
    return Response.json(
      { error: "Não foi possível criar o atendente. Verifique a service account." },
      { status: 500 }
    );
  }
}
