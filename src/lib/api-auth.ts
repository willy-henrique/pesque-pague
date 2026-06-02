import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import type { Usuario } from "@/types";

export async function verifyAdminRequest(request: Request) {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new Response(JSON.stringify({ error: "Não autenticado." }), { status: 401 });
  }

  const token = header.slice(7);
  let uid: string;

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    throw new Response(JSON.stringify({ error: "Token inválido." }), { status: 401 });
  }

  const snap = await getAdminDb().collection("usuarios").doc(uid).get();
  const profile = snap.exists ? ({ id: snap.id, ...snap.data() } as Usuario) : null;

  if (!profile || profile.role !== "admin" || !profile.ativo) {
    throw new Response(JSON.stringify({ error: "Acesso negado." }), { status: 403 });
  }

  return { uid, profile };
}

export async function parseJsonBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Response(JSON.stringify({ error: "JSON inválido." }), { status: 400 });
  }
}
