import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, push, set, remove } from "firebase/database";

// กำหนด config ของ Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBxfUQBX3SLd2f9V2J6TAgwD5Kuz4UH2ro",
  authDomain: "nailties.firebaseapp.com",
  databaseURL: "https://nailties-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "nailties",
  storageBucket: "nailties.appspot.com",
  messagingSenderId: "491264748856",
  appId: "1:491264748856:web:2a69c3e2643d21299aa5cd"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// ดึง database
const database = getDatabase(app);

// ✅ export ที่ App.js ต้องใช้
export { database, ref, onValue, push, set, remove };
