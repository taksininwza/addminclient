import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getDatabase, ServerValue } from 'firebase-admin/database';

const app = getApps().length
  ? getApps()[0]!
  : initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });

export const rtdb = getDatabase(app);
export const db = rtdb;  // ✅ alias ให้ชื่อ db ใช้งานได้
export const serverTimestamp = ServerValue.TIMESTAMP;

export default app; 
