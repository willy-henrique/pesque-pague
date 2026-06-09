import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { DEV_EMAIL } from "@/lib/dev-auth";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

// No auth required — bootstraps the dev account on first run.
// Safe: password comes from server env vars only; repeated calls are idempotent.
export async function POST() {
  try {
    const devPassword = process.env.DEV_PASSWORD?.trim() || "@Claro2014";
    const auth        = getAdminAuth();
    const db          = getAdminDb();

    // Check if account already exists
    try {
      const existing = await auth.getUserByEmail(DEV_EMAIL);

      // Ensure custom claim is set
      const claims = (await auth.getUser(existing.uid)).customClaims ?? {};
      if (!claims["role"]) {
        await auth.setCustomUserClaims(existing.uid, { role: "dev" });
      }

      // Ensure Firestore doc exists
      const ref  = db.collection("usuarios").doc(existing.uid);
      const snap = await ref.get();
      if (!snap.exists) {
        await ref.set({
          nome:     "Desenvolvedor",
          email:    DEV_EMAIL,
          role:     "dev",
          ativo:    true,
          criadoEm: FieldValue.serverTimestamp(),
        });
      }

      return Response.json({ ok: true, created: false });
    } catch (err) {
      if ((err as { code?: string }).code !== "auth/user-not-found") throw err;
    }

    // Create account
    const user = await auth.createUser({
      email:       DEV_EMAIL,
      password:    devPassword,
      displayName: "Desenvolvedor",
      disabled:    false,
    });

    await auth.setCustomUserClaims(user.uid, { role: "dev" });

    await db.collection("usuarios").doc(user.uid).set({
      nome:     "Desenvolvedor",
      email:    DEV_EMAIL,
      role:     "dev",
      ativo:    true,
      criadoEm: FieldValue.serverTimestamp(),
    });

    return Response.json({ ok: true, created: true });
  } catch (err) {
    console.error("[POST /api/dev/init]", err);
    return Response.json({ error: "Erro ao inicializar conta de desenvolvedor." }, { status: 500 });
  }
}
