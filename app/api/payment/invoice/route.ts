// app/api/payment/invoice/route.ts
import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { computeUniqueAmount } from '@/lib/uniqueAmount';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const baseAmount = Number(body?.baseAmount ?? 100);

  const payment_ref = 'NAIL-' + nanoid(6).toUpperCase();
  const amount = computeUniqueAmount(baseAmount, payment_ref);
  const expires_at = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  return NextResponse.json({
    ok: true,
    payment_ref,
    amount,
    qr_url: `/api/payment/qr?amount=${encodeURIComponent(amount)}&ref=${encodeURIComponent(payment_ref)}`,
    expires_at,
  });
}
