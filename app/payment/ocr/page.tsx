// app/payment/ocr/page.tsx
import { Suspense } from 'react';
import OcrClient from './OcrClient';

// กันไม่ให้ถูก prerender แบบ Static
export const dynamic = 'force-dynamic'; // หรือ export const revalidate = false

export default function Page() {
  return (
    <Suspense fallback={<div style={{padding:16}}>กำลังโหลด…</div>}>
      <OcrClient />
    </Suspense>
  );
}
