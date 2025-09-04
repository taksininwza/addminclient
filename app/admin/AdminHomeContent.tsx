// app/home/AdminHomeContent.tsx
'use client';

import React, { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { database, ref, onValue, set, update, remove } from '@/lib/firebase';

/* =========================
   ส่วนที่ 1: จัดการโปรโมชัน
   ========================= */

type Promo = {
  title: string;
  subtitle?: string;
  discountPercent?: number;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  active: boolean;
  imageUrl?: string;
};

const normalizeISO = (s?: string) => {
  if (!s) return '';
  const fmts = ['YYYY-MM-DD', 'DD/MM/YYYY', 'YYYY/MM/DD'];
  for (const f of fmts) {
    const d = dayjs(s, f, true);
    if (d.isValid()) return d.format('YYYY-MM-DD');
  }
  const d2 = dayjs(s);
  return d2.isValid() ? d2.format('YYYY-MM-DD') : '';
};

// แปลงค่าทุกแบบให้เป็น boolean
const toBool = (v: any) => v === true || v === 'true' || v === 1 || v === '1';

/* =========================
   ส่วนที่ 2: จัดการรีวิวลูกค้า
   ========================= */

type Review = {
  id: string;
  name?: string;
  rating?: number;
  // รองรับหลายคีย์ที่อาจใช้เป็นข้อความของลูกค้า
  message?: string;
  created_at?: string | number;
  adminReply?: string;
  adminReplyUpdatedAt?: string;
};

/* =========================
   Component หลัก
   ========================= */

export default function AdminHomeContent() {
  /* ----- โปรโมชัน ----- */
  const [promo, setPromo] = useState<Promo>({
    title: '',
    subtitle: '',
    discountPercent: undefined,
    startDate: '',
    endDate: '',
    active: false,
    imageUrl: '/pic.jpg',
  });
  const promoPath = 'home/promotion';

  useEffect(() => {
    const unsub = onValue(ref(database, promoPath), (snap) => {
      const raw = (snap.val() || {}) as any;

      const norm: Promo = {
        title: raw.title ?? '',
        subtitle: raw.subtitle ?? '',
        discountPercent:
          typeof raw.discountPercent === 'number'
            ? raw.discountPercent
            : Number(raw.discountPercent) || undefined,
        startDate: normalizeISO(raw.startDate),
        endDate: normalizeISO(raw.endDate),
        active: toBool(raw.active),
        imageUrl: raw.imageUrl || '/pic.jpg',
      };

      setPromo(norm);
    });
    return () => unsub();
  }, []);

  const savePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Promo = {
      ...promo,
      startDate: normalizeISO(promo.startDate),
      endDate: normalizeISO(promo.endDate),
      active: !!promo.active,
    };
    await set(ref(database, promoPath), payload);
    alert('บันทึกโปรโมชันแล้ว');
  };

  /* ----- รีวิวลูกค้า ----- */
  const [reviews, setReviews] = useState<Review[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    const off = onValue(ref(database, 'reviews'), (snap) => {
      const raw = snap.val() || {};
      const arr: Review[] = Object.entries<any>(raw).map(([id, r]) => {
        // ดึงข้อความลูกค้า รองรับหลายคีย์ที่อาจใช้อยู่แล้วในฐานข้อมูล
        const msg =
          r?.message ??
          r?.text ??
          r?.comment ??
          r?.content ??
          r?.body ??
          r?.review ??
          '';

        return {
          id,
          name: r?.name ?? r?.customerName ?? r?.user ?? '',
          rating: typeof r?.rating === 'number' ? r.rating : Number(r?.rating) || undefined,
          message: String(msg || ''),
          created_at: r?.created_at ?? r?.createdAt ?? r?.timestamp ?? '',
          adminReply: r?.adminReply ?? r?.reply ?? '',
          adminReplyUpdatedAt: r?.adminReplyUpdatedAt ?? r?.replyUpdatedAt ?? '',
        };
      });

      // เรียงใหม่ล่าสุดอยู่บน
      arr.sort(
        (a, b) =>
          dayjs(b.created_at || 0).valueOf() - dayjs(a.created_at || 0).valueOf()
      );
      setReviews(arr);
    });
    return () => off();
  }, []);

  const onChangeReply = (id: string, text: string) => {
    setReviews((prev) => prev.map((x) => (x.id === id ? { ...x, adminReply: text } : x)));
  };

  const saveReply = async (rv: Review) => {
    setSavingId(rv.id);
    try {
      await update(ref(database, `reviews/${rv.id}`), {
        adminReply: rv.adminReply || '',
        adminReplyUpdatedAt: new Date().toISOString(),
      });
    } finally {
      setSavingId(null);
    }
  };

  const deleteReview = async (rv: Review) => {
    if (!confirm('ลบรีวิวนี้ใช่ไหม?')) return;
    await remove(ref(database, `reviews/${rv.id}`));
  };

  /* =========================
     UI
     ========================= */
  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: 24 }}>
      {/* ===== โปรโมชัน ===== */}
      <form onSubmit={savePromo} style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 16 }}>
          🎉 โปรโมชันหน้า Home
        </h1>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>
            หัวข้อ
          </label>
          <input
            value={promo.title}
            onChange={(e) => setPromo((p) => ({ ...p, title: e.target.value }))}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid #e5e7eb',
            }}
            required
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>
            รายละเอียด
          </label>
          <input
            value={promo.subtitle || ''}
            onChange={(e) => setPromo((p) => ({ ...p, subtitle: e.target.value }))}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid #e5e7eb',
            }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>
            ส่วนลด (%)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={promo.discountPercent ?? ''}
            onChange={(e) =>
              setPromo((p) => ({
                ...p,
                discountPercent: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
            style={{
              width: 160,
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid #e5e7eb',
            }}
          />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div>
            <label style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>
              เริ่มวันที่
            </label>
            <input
              type="date"
              value={promo.startDate || ''}
              onChange={(e) => setPromo((p) => ({ ...p, startDate: e.target.value }))}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid #e5e7eb',
              }}
            />
          </div>
          <div>
            <label style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>
              สิ้นสุดวันที่
            </label>
            <input
              type="date"
              value={promo.endDate || ''}
              onChange={(e) => setPromo((p) => ({ ...p, endDate: e.target.value }))}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid #e5e7eb',
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>
            รูปโปรโมชัน (URL)
          </label>
          <input
            value={promo.imageUrl || ''}
            onChange={(e) => setPromo((p) => ({ ...p, imageUrl: e.target.value }))}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid #e5e7eb',
            }}
            placeholder="/pic.jpg หรือ https://..."
          />
        </div>

        <div style={{ margin: '10px 0 18px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={promo.active}
              onChange={(e) => setPromo((p) => ({ ...p, active: e.target.checked }))}
            />
            แสดงบนหน้า Home
          </label>
        </div>

        <button
          type="submit"
          style={{
            padding: '10px 18px',
            borderRadius: 10,
            border: 'none',
            background: 'linear-gradient(135deg,#4f8cff,#a78bfa)',
            color: '#fff',
            fontWeight: 800,
            cursor: 'pointer',
            minWidth: 160,
          }}
        >
          บันทึก
        </button>
      </form>

      {/* เส้นคั่นเล็ก ๆ */}
      <hr style={{ border: 0, borderTop: '1px solid #f1f5f9', margin: '12px 0 24px' }} />

      {/* ===== รีวิวจากลูกค้า ===== */}
      <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 10, color: '#c2185b' }}>
        รีวิวจากลูกค้า
      </h2>

      <div style={{ display: 'grid', gap: 12 }}>
        {reviews.map((rv) => {
          const when = rv.created_at
            ? dayjs(rv.created_at).isValid()
              ? dayjs(rv.created_at).format('DD MMM YYYY HH:mm')
              : String(rv.created_at)
            : '';

          return (
            <div
              key={rv.id}
              style={{
                background: '#fff',
                borderRadius: 14,
                border: '1px solid #fee2f2',
                boxShadow: '0 6px 24px rgba(173,20,87,.05)',
                padding: 14,
                display: 'grid',
                gap: 12,
              }}
            >
              {/* หัวการ์ด */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontWeight: 900, color: '#AD1457' }}>
                    {rv.name || 'ไม่ระบุชื่อ'}{' '}
                    <span style={{ color: '#64748b', fontWeight: 600, fontSize: 13 }}>
                      {rv.rating ? '★'.repeat(Math.round(rv.rating)) : ''}
                    </span>
                  </div>
                  {when && (
                    <div style={{ color: '#94a3b8', fontSize: 12 }}>ส่งเมื่อ {when}</div>
                  )}
                </div>

                <button
                  onClick={() => deleteReview(rv)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: '2px solid #ef9a9a',
                    background: '#fff',
                    color: '#c62828',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  ลบรีวิว
                </button>
              </div>

              {/* ✅ ข้อความของลูกค้า */}
              {rv.message && (
                <div
                  style={{
                    background: '#fff7fb',
                    border: '1px solid #ffd6ec',
                    borderRadius: 12,
                    padding: 12,
                    color: '#334155',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {rv.message}
                </div>
              )}

             

                  {rv.adminReplyUpdatedAt && (
                    <div style={{ color: '#94a3b8', fontSize: 12 }}>
                      อัปเดตล่าสุด:{' '}
                      {dayjs(rv.adminReplyUpdatedAt).format('DD MMM YYYY HH:mm')}
                    </div>
                  )}
                </div>
              
            
          );
        })}

        {reviews.length === 0 && (
          <div style={{ color: '#64748b', fontStyle: 'italic' }}>ยังไม่มีรีวิว</div>
        )}
      </div>
    </div>
  );
}
