import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Usuario, UserRole } from "@/types";

export async function fetchUsuario(uid: string): Promise<Usuario | null> {
  const snap = await getDoc(doc(db, "usuarios", uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Usuario;
}

/** Primeiro login no ERP: vincula o usuário Auth como administrador. */
export async function bootstrapAdminIfNeeded(
  uid: string,
  email: string | null
): Promise<Usuario> {
  const ref = doc(db, "usuarios", uid);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    return { id: existing.id, ...existing.data() } as Usuario;
  }

  const count = await getCountFromServer(collection(db, "usuarios"));
  if (count.data().count > 0) {
    throw new Error("Perfil não encontrado. Peça ao administrador para liberar seu acesso.");
  }

  const usuario: Omit<Usuario, "id"> = {
    nome: email?.split("@")[0] || "Administrador",
    email: email ?? "",
    role: "admin",
    ativo: true,
    criadoEm: serverTimestamp() as Usuario["criadoEm"],
  };

  await setDoc(ref, usuario);
  return { id: uid, ...usuario };
}

export function canAccessAdmin(profile: Usuario | null) {
  return profile?.role === "admin" && profile.ativo;
}

export function canAccessAtendente(profile: Usuario | null) {
  return profile?.role === "atendente" && profile.ativo;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin:     "Administrador",
  atendente: "Atendente",
  marlon:    "Admin Geral",
};
