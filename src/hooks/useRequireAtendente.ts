"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { canAccessAtendente, fetchUsuario } from "@/lib/usuarios";
import type { Usuario } from "@/types";

export function useRequireAtendente(options?: { skip?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const skip = options?.skip ?? false;
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(!skip);

  useEffect(() => {
    if (skip) {
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUsuario(null);
        setLoading(false);
        const redirect = encodeURIComponent(pathname);
        router.replace(`/atendente/login?redirect=${redirect}`);
        return;
      }

      const profile = await fetchUsuario(user.uid);
      if (!canAccessAtendente(profile)) {
        await signOut(auth);
        setUsuario(null);
        setLoading(false);
        router.replace("/atendente/login?erro=acesso");
        return;
      }

      setUsuario(profile);
      setLoading(false);
    });

    return unsub;
  }, [pathname, router, skip]);

  return { usuario, loading };
}
