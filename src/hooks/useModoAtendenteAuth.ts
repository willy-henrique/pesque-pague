"use client";

import { useSearchParams } from "next/navigation";
import { isModoAtendente } from "@/lib/atendente";

export function useModoAtendenteAuth() {
  const searchParams = useSearchParams();
  const modoAtendente = isModoAtendente(searchParams);

  return { modoAtendente, ready: true };
}
