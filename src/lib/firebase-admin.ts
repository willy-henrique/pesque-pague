import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type ServiceAccountShape = Record<string, string>;

const DEFAULT_SERVICE_ACCOUNT_PATHS = [
  "firebase-service-account.json",
  "service-account.json",
  "firebase-adminsdk.json",
  "credentials/firebase-service-account.json",
  "credentials/service-account.json",
  "secrets/firebase-service-account.json",
  "secrets/service-account.json",
];

function resolveFromProject(relativePath: string) {
  return path.join(/* turbopackIgnore: true */ process.cwd(), relativePath);
}

function normalizeServiceAccount(serviceAccount: ServiceAccountShape) {
  if (typeof serviceAccount.private_key === "string") {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }

  return serviceAccount;
}

function parseServiceAccount(raw: string, sourceLabel: string) {
  try {
    return normalizeServiceAccount(JSON.parse(raw) as ServiceAccountShape);
  } catch {
    throw new Error(`${sourceLabel} inválido(a) (JSON esperado).`);
  }
}

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (raw) {
    return parseServiceAccount(raw, "FIREBASE_SERVICE_ACCOUNT_KEY");
  }

  const explicitPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim()
    || process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();

  const candidatePaths = [
    ...(explicitPath
      ? [path.isAbsolute(explicitPath) ? explicitPath : resolveFromProject(explicitPath)]
      : []),
    ...DEFAULT_SERVICE_ACCOUNT_PATHS.map(resolveFromProject),
  ];

  for (const candidate of candidatePaths) {
    if (!existsSync(candidate)) continue;
    const rawFile = readFileSync(candidate, "utf8").trim();
    if (!rawFile) continue;
    return parseServiceAccount(rawFile, `Service account em ${candidate}`);
  }

  throw new Error(
    "Service account do Firebase não configurada. Use FIREBASE_SERVICE_ACCOUNT_KEY, FIREBASE_SERVICE_ACCOUNT_PATH, GOOGLE_APPLICATION_CREDENTIALS ou um arquivo JSON padrão no projeto."
  );
}

function initAdminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const serviceAccount = loadServiceAccount();

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
