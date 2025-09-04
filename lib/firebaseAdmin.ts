// lib/firebaseAdmin.ts
import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

let app: App | undefined;

function loadServiceAccount() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    // ใช้ JSON เดียว
    const parsed = JSON.parse(json);
    if (!parsed.project_id) {
      throw new Error('Service account JSON missing "project_id"');
    }
    return parsed;
  }
  // หรือใช้ตัวแปรแยก
  const project_id = process.env.FB_PROJECT_ID;
  const client_email = process.env.FB_CLIENT_EMAIL;
  let private_key = process.env.FB_PRIVATE_KEY;
  if (private_key?.includes('\\n')) private_key = private_key.replace(/\\n/g, '\n');

  if (!project_id || !client_email || !private_key) {
    throw new Error('Missing Firebase admin envs');
  }
  return { project_id, client_email, private_key };
}

export function getAdminApp() {
  if (!app) {
    const sa = loadServiceAccount();
    app = initializeApp({
      credential: cert(sa as any),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
  }
  return app!;
}

export function adminDb() {
  return getDatabase(getAdminApp());
}
export const rtdb = adminDb();

export const db = rtdb;
export const serverTimestamp = { '.sv': 'timestamp' };