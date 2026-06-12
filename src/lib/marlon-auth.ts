import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

export async function verifyMarlonRequest(request: Request): Promise<{ uid: string; email: string }> {
  const header = request.headers.get("Authorization");
  if (header?.startsWith("Bearer ")) {
    try {
      const decoded = await getAdminAuth().verifyIdToken(header.slice(7));
      if (decoded["role"] === "marlon") {
        return { uid: decoded.uid, email: decoded.email ?? "" };
      }
    } catch { /* fall through */ }
  }
  throw new Response(JSON.stringify({ error: "Acesso negado." }), { status: 401 });
}

export async function initMarlonAccount(email: string, password: string): Promise<{ uid: string; created: boolean }> {
  const auth = getAdminAuth();
  const db   = getAdminDb();

  try {
    const existing = await auth.getUserByEmail(email);
    await auth.setCustomUserClaims(existing.uid, { role: "marlon" });
    await db.collection("usuarios").doc(existing.uid).set(
      { nome: "Marlon", email, role: "marlon", ativo: true },
      { merge: true }
    );
    return { uid: existing.uid, created: false };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== "auth/user-not-found") throw err;

    const user = await auth.createUser({ email, password, displayName: "Marlon", disabled: false });
    await auth.setCustomUserClaims(user.uid, { role: "marlon" });
    await db.collection("usuarios").doc(user.uid).set({
      nome: "Marlon", email, role: "marlon", ativo: true,
    });
    return { uid: user.uid, created: true };
  }
}
