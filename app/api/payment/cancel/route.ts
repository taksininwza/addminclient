import { NextResponse } from "next/server";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

function getAdminApp() {
  if (getApps().length) return getApps()[0]!;
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

export async function POST(req: Request) {
  try {
    const { paymentId, hardDelete } = await req.json();
    if (!paymentId) {
      return NextResponse.json({ ok: false, error: "Missing paymentId" }, { status: 400 });
    }

    const app = getAdminApp();
    const db = getDatabase(app);
    const ref = db.ref(`payments/${paymentId}`);
    const snap = await ref.get();
    if (!snap.exists()) {
      return NextResponse.json({ ok: false, error: "Payment not found" }, { status: 404 });
    }

    if (hardDelete) {
      await ref.remove();
    } else {
      await ref.update({
  status: "cancelled",
  payment_status: "cancelled",
  matched: false,
  cancelledAt: Date.now(),
});

    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[payment/cancel] error:", err);
    return NextResponse.json({ ok: false, error: err?.message || "Internal error" }, { status: 500 });
  }
  
}

