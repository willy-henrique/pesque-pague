"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { isModoAtendente } from "@/lib/atendente";
import { canAccessAtendente, fetchUsuario } from "@/lib/usuarios";

/** Exige login de atendente nas telas /pique/...?modo=atendente */
export function useModoAtendenteAuth() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const modoAtendente = isModoAtendente(searchParams);
  const [ready, setReady] = useState(!modoAtendente);

  useEffect(() => {
    if (!modoAtendente) {
      setReady(true);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        const redirect = encodeURIComponent(`${pathname}?${searchParams.toString()}`);
        router.replace(`/atendente/login?redirect=${redirect}`);
        return;
      }

      const profile = await fetchUsuario(user.uid);
      if (!canAccessAtendente(profile)) {
        await signOut(auth);
        router.replace("/atendente/login?erro=acesso");
        return;
      }

      setReady(true);
    });

    return unsub;
  }, [modoAtendente, pathname, router, searchParams]);

  return { modoAtendente, ready };
}
