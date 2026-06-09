import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export type LogTipo =
  | "admin_criado"     | "admin_removido"     | "admin_ativado"     | "admin_desativado"
  | "atendente_criado" | "atendente_removido" | "atendente_ativado" | "atendente_desativado"
  | "dev_login"        | "info";

export interface LogEntry {
  id: string;
  tipo: LogTipo;
  mensagem: string;
  ator: string;
  metadata: Record<string, unknown>;
  criadoEm: string | null;
}

// Fire-and-forget: never throws, never blocks the main operation
export async function writeLog(
  tipo: LogTipo,
  mensagem: string,
  ator: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await getAdminDb().collection("logs").add({
      tipo,
      mensagem,
      ator,
      metadata: metadata ?? {},
      criadoEm: FieldValue.serverTimestamp(),
    });
  } catch {
    // intentionally swallowed
  }
}
