/** Query `?modo=atendente` — fluxo do app web do atendente (sem login admin). */
export function isModoAtendente(searchParams: URLSearchParams | null) {
  return searchParams?.get("modo") === "atendente";
}

export function withModoAtendente(path: string) {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}modo=atendente`;
}
