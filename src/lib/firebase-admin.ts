import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function initAdminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY não configurada. Adicione o JSON da service account nas variáveis de ambiente."
    );
  }

  let serviceAccount: Record<string, string>;
  try {
    serviceAccount = JSON.parse(raw) as Record<string, string>;
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY inválida (JSON esperado).");
  }

  return initializeApp({
    credential: cert(serviceAccount as Parameters<typeof cert>[0]),
  });
}

export function getAdminApp() {
  return initAdminApp();
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}
