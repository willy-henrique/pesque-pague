import { auth } from "@/lib/firebase";

const DEFAULT_FIXED_ADMIN_TOKEN = "WILLTECH_ADMIN_FIXED_TOKEN";

export async function getAuthBearerToken() {
  const user = auth.currentUser;
  if (!user) throw new Error("Não autenticado.");
  return user.getIdToken();
}

export async function adminFetch(path: string, init?: RequestInit) {
  const request = async (forceRefresh = false) => {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken(forceRefresh) : "";
    const fixedToken =
      process.env.NEXT_PUBLIC_ADMIN_FIXED_TOKEN?.trim() || DEFAULT_FIXED_ADMIN_TOKEN;

    return fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "x-admin-token": fixedToken,
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
