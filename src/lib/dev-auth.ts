import { getAdminAuth } from "@/lib/firebase-admin";

export const DEV_EMAIL  = process.env.DEV_EMAIL?.trim()        || "willydev01@gmail.com";
export const DEV_SECRET = process.env.DEV_PANEL_SECRET?.trim() || "willydev2025";

export async function verifyDevRequest(request: Request): Promise<{ uid: string; email: string }> {
  // Fixed token (bootstrap / backwards compat with existing routes)
  const fixed = request.headers.get("x-dev-token")?.trim();
  if (fixed === DEV_SECRET) return { uid: "dev-fixed", email: DEV_EMAIL };

  // Firebase ID token (used after login with willydev01@gmail.com)
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const decoded = await getAdminAuth().verifyIdToken(authHeader.slice(7));
      const isDevUser = decoded.email === DEV_EMAIL || decoded["role"] === "dev";
      if (isDevUser) return { uid: decoded.uid, email: decoded.email ?? DEV_EMAIL };
    } catch {
      // invalid token — fall through
    }
  }

  throw new Response(JSON.stringify({ error: "Acesso negado." }), { status: 401 });
}
