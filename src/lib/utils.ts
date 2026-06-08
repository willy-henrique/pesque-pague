import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function getBrasiliaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const day = parts.find((p) => p.type === "day")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const year = parts.find((p) => p.type === "year")?.value;

  return `${year}-${month}-${day}`;
}

export function isSameBrasiliaDay(date: Date, reference = new Date()) {
  return getBrasiliaDateKey(date) === getBrasiliaDateKey(reference);
}

export function isBeforeBrasiliaDay(date: Date, reference = new Date()) {
  return getBrasiliaDateKey(date) < getBrasiliaDateKey(reference);
}

export const ORDER_CANCEL_WINDOW_MS = 4 * 60 * 1000;

export function canCancelOrder(createdAt: Date, now = new Date()) {
  return now.getTime() - createdAt.getTime() <= ORDER_CANCEL_WINDOW_MS;
}

export function getRelativeTime(date: Date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora mesmo";
  if (mins < 60) return `${mins}min atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h atrás`;
  return formatDate(date);
}

export function generateOrderId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function getPublicAppUrl() {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, "");

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "";
}

/** Aplica máscara de telefone brasileiro: (XX) XXXX-XXXX ou (XX) XXXXX-XXXX */
export function formatarTelefone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  const n = digits.length;
  if (n === 0) return "";
  if (n <= 2) return `(${digits}`;
  if (n <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (n <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** Compara dois telefones ignorando formatação (apenas dígitos) */
export function telefonesIguais(a: string, b: string): boolean {
  return a.replace(/\D/g, "") === b.replace(/\D/g, "");
}

export function buildPiquePublicUrl(piqueId: string) {
  const base = getPublicAppUrl();
  if (!base) return `/pique/${piqueId}`;
  return `${base}/pique/${piqueId}`;
}
