// lib/firebase.ts  (หรือ lib/firebase.js)
import { initializeApp, getApp, getApps } from "firebase/app";
import {
  getDatabase,
  ref,
  onValue,
  push,
  set,
  remove,
  update,
  runTransaction,
  query,
  orderByChild,
  limitToLast,
  child,
  get,
  onChildAdded,
  onChildRemoved,
  onChildChanged,
  serverTimestamp,
} from "firebase/database";

// !!! ใช้ค่าโปรเจ็กต์ของคุณเอง
const firebaseConfig = {
  apiKey: "AIzaSyBxfUQBX3SLd2f9V2J6TAgwD5Kuz4UH2ro",
  authDomain: "nailties.firebaseapp.com",
  databaseURL:
    "https://nailties-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "nailties",
  storageBucket: "nailties.appspot.com",
  messagingSenderId: "491264748856",
  appId: "1:491264748856:web:2a69c3e2643d21299aa5cd",
};

// ป้องกัน init ซ้ำเวลา HMR
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const database = getDatabase(app);

// re-export ให้ไฟล์อื่นๆ import จากที่เดียว
export {
  ref,
  onValue,
  push,
  set,
  remove,
  update,          // ✅ เพิ่ม
  runTransaction,  // ✅ เพิ่ม
  query,
  orderByChild,
  limitToLast,
  child,
  get,
  onChildAdded,
  onChildRemoved,
  onChildChanged,
  serverTimestamp,
};
