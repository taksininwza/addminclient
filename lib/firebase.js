import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getDatabase, ref, onValue, push, set, remove,
  query, orderByChild, limitToLast
} from "firebase/database";
const BLOCK_STATUSES = new Set(['paid', 'free', 'pending', 'awaiting_slip']);

const firebaseConfig = {
  apiKey: "AIzaSyBxfUQBX3SLd2f9V2J6TAgwD5Kuz4UH2ro",
  authDomain: "nailties.firebaseapp.com",
  databaseURL: "https://nailties-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "nailties",
  storageBucket: "nailties.appspot.com",
  messagingSenderId: "491264748856",
  appId: "1:491264748856:web:2a69c3e2643d21299aa5cd"
};

// ป้องกัน init ซ้ำเวลา Hot Reload
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const database = getDatabase(app);

export {
  database,
  ref, onValue, push, set, remove,
  query, orderByChild, limitToLast
};
