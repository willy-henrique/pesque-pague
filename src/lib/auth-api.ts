import { auth } from "@/lib/firebase";

export async function getAuthBearerToken() {
  const user = auth.currentUser;
  if (!user) throw new Error("Não autenticado.");
  return user.getIdToken();
}

export async function adminFetch(path: string, init?: RequestInit) {
  const token = await getAuthBearerToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof body.error === "string" ? body.error : "Falha na requisição."
    );
  }
  return body;
}
