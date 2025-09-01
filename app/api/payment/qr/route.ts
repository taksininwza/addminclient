// app/api/payment/qr/route.ts
import { NextResponse } from 'next/server';
import { generatePromptPayQR } from '@/lib/promptpay';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const amount = Number(searchParams.get('amount'));
  const ref = searchParams.get('ref') || '';
  const id = process.env.PROMPTPAY_ID || '';

  if (!Number.isFinite(amount) || amount <= 0) {
    return new NextResponse('invalid amount', { status: 400 });
  }
  if (!id) return new NextResponse('missing PROMPTPAY_ID', { status: 500 });

  const png = await generatePromptPayQR(id, amount, ref);
  return new NextResponse(Uint8Array.from(png), {
    status: 200,
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
  });
}
