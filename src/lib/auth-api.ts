import { auth } from "@/lib/firebase";

export async function getAuthBearerToken() {
  const user = auth.currentUser;
  if (!user) throw new Error("Não autenticado.");
  return user.getIdToken();
}

export async function adminFetch(path: string, init?: RequestInit) {
  const request = async (forceRefresh = false) => {
    const user = auth.currentUser;
    if (!user) throw new Error("Não autenticado.");

    const token = await user.getIdToken(forceRefresh);
    return fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...init?.headers,
      },
    });
  };

  let res = await request();

  if (res.status === 401) {
    res = await request(true);
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof body.error === "string" ? body.error : "Falha na requisição."
    );
  }
  return body;
}

export async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
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
