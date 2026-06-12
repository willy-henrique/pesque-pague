import { initMarlonAccount } from "@/lib/marlon-auth";
import { verifyDevRequest } from "@/lib/dev-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await verifyDevRequest(request);
  } catch (res) {
    return res as Response;
  }

  try {
    const body = (await request.json()) as { email?: string; senha?: string };
    const email = body.email?.trim().toLowerCase();
    const senha = body.senha ?? "";

    if (!email?.includes("@")) return Response.json({ error: "E-mail inválido." }, { status: 400 });
    if (senha.length < 6)       return Response.json({ error: "Senha mínima: 6 caracteres." }, { status: 400 });

    const result = await initMarlonAccount(email, senha);
    return Response.json({ ok: true, ...result });
  } catch (err) {
    console.error("[POST /api/marlon/init]", err);
    return Response.json({ error: "Erro ao inicializar conta." }, { status: 500 });
  }
}
