// app/availability/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import Link from 'next/link';
import Image from 'next/image';
import { database, ref, onValue } from '@/lib/firebase';
import { computeAvailableStartTimes, type UnavailMap } from '@/lib/availability';

type Barber = { name: string };
type Reservation = { appointment_date: string; appointment_time: string; barber_id?: string; };
type Payment = { date?: string; time?: string; barber?: string; barber_id?: string; status?: string; matched?: boolean; };
type HoldNode = { expires_at_ms?: number; owner?: string };

const LOGO_SIZE = 64;
const OPEN_HOUR = 10;
const CLOSE_HOUR = 20;
const SLOT_MIN = 60;
const LUNCH_START = 12;
const LUNCH_END = 13;

export default function AvailabilityPage() {
  const [dateStr, setDateStr] = useState(dayjs().format('YYYY-MM-DD'));
  const [durationHours, setDurationHours] = useState<number>(1);

  const [barbers, setBarbers] = useState<Record<string, Barber>>({});
  const [reservations, setReservations] = useState<Record<string, Reservation>>({});
  const [payments, setPayments] = useState<Record<string, Payment>>({});
  const [holds, setHolds] = useState<Record<string, Record<string, Record<string, HoldNode>>>>({});
  const [unavailability, setUnavailability] = useState<UnavailMap>({});

  useEffect(() => {
    const offBarbers = onValue(ref(database, 'barbers'), s => setBarbers(s.val() || {}));
    const offRes = onValue(ref(database, 'reservations'), s => setReservations(s.val() || {}));
    const offPay = onValue(ref(database, 'payments'), s => setPayments(s.val() || {}));
    const offUA = onValue(ref(database, 'unavailability'), snap => {
      const raw = snap.val() || {};
      const norm: UnavailMap = {};
      Object.entries<any>(raw).forEach(([barberId, blocks]) => {
        if (Array.isArray(blocks)) {
          norm[barberId] = blocks.filter(Boolean);
        } else if (blocks && typeof blocks === 'object') {
          norm[barberId] = Object.entries(blocks).map(([id, v]: any) => ({
            id, date: v.date, start: v.start, end: v.end, note: v.note,
          }));
        }
      });
      setUnavailability(norm);
    });
    return () => { offBarbers(); offRes(); offPay(); offUA(); };
  }, []);

  useEffect(() => {
    if (!dateStr) return;
    const off = onValue(ref(database, `slot_holds/${dateStr}`), snap => {
      setHolds({ [dateStr]: snap.val() || {} });
    });
    return () => off();
  }, [dateStr]);

  const timeSlots = useMemo(() => {
    const base = dayjs(dateStr);
    const slots: string[] = [];
    let t = base.hour(OPEN_HOUR).minute(0).second(0).millisecond(0);
    const end = base.hour(CLOSE_HOUR).minute(0).second(0).millisecond(0);
    while (t.isBefore(end)) {
      const h = t.hour();
      if (h < LUNCH_START || h >= LUNCH_END) slots.push(t.format('HH:mm'));
      t = t.add(SLOT_MIN, 'minute');
    }
    if (base.isSame(dayjs(), 'day')) {
      return slots.filter(hhmm => dayjs(`${dateStr} ${hhmm}`).isAfter(dayjs()));
    }
    return slots;
  }, [dateStr]);

  const reservedByBarber: Record<string, Set<string>> = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    Object.values(reservations || {}).forEach(r => {
      if (!r?.appointment_date || !r?.appointment_time || !r?.barber_id) return;
      if (r.appointment_date !== dateStr) return;
      if (!map[r.barber_id]) map[r.barber_id] = new Set();
      map[r.barber_id].add(r.appointment_time);
    });
    Object.values(payments || {}).forEach(p => {
      const isConfirmed = p?.status === 'confirmed' || p?.matched === true;
      if (!isConfirmed || !p?.date || !p?.time) return;
      if (p.date !== dateStr) return;
      const barberId = p.barber_id;
      if (!barberId) return;
      if (!map[barberId]) map[barberId] = new Set();
      map[barberId].add(p.time);
    });
    return map;
  }, [reservations, payments, dateStr]);

  const getAvailableStartTimes = (barberId: string): string[] => {
    const reservedTimes = reservedByBarber[barberId] || new Set<string>();
    return computeAvailableStartTimes({
      timeSlots,
      hours: Math.max(1, durationHours),
      dateStr,
      barberId,
      reservedTimes,
      holds,
      unavailability,
    });
  };

  const renderRange = (start: string) =>
    `${start}–${dayjs(`${dateStr} ${start}`).add(durationHours * SLOT_MIN, 'minute').format('HH:mm')}`;

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(1200px 600px at 10% -10%, #ffe4f3 0%, transparent 60%), radial-gradient(900px 500px at 90% 0%, #e9e7ff 0%, transparent 50%), #ffffff',
        fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Arial, sans-serif',
        color: '#0f172a'
      }}
    >
      {/* Navbar */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          backdropFilter: 'saturate(180%) blur(6px)',
          background: 'rgba(255,255,255,.7)',
          borderBottom: '1px solid #f1f5f9'
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}
        >
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: '#0f172a' }}>
            <Image src="/logo.png" alt="Nailties logo" width={LOGO_SIZE} height={LOGO_SIZE} style={{ borderRadius: 10 }} priority />
            <span style={{ fontWeight: 900, letterSpacing: 0.2, fontSize: 22 }}>Nailties</span>
          </Link>

          <nav style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
            <Link href="/" style={btn}>Home</Link>
          </nav>
        </div>
      </header>

      {/* Content */}
      <section style={{ maxWidth: 1100, margin: '20px auto', padding: '0 16px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#c2185b', marginBottom: 12 }}>
          คิวว่างตามช่าง
        </h1>

        {/* Filters — ย่อขนาดให้พอดี */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            marginBottom: 16
          }}
        >
          <div style={{ width: 'min(100%, 320px)' }}>
            <label style={{ fontWeight: 800, color: '#c2185b' }}>วันที่</label>
            <input
              type="date"
              min={dayjs().format('YYYY-MM-DD')}
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              style={inputNarrow}
            />
          </div>

          <div style={{ width: 'min(100%, 180px)' }}>
            <label style={{ fontWeight: 800, color: '#c2185b' }}>ระยะเวลา (ชั่วโมง)</label>
            <select
              value={durationHours}
              onChange={(e) => setDurationHours(Math.max(1, Number(e.target.value)))}
              style={inputNarrow}
            >
              {[1,2,3,4,5,6,7,8].map(h => (
                <option key={h} value={h}>{h} ชั่วโมง</option>
              ))}
            </select>
          </div>
        </div>

        {/* Barber cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {Object.entries(barbers).map(([barberId, b]) => {
            const avail = getAvailableStartTimes(barberId);
            return (
              <div key={barberId} style={card}>
                <div style={{ padding: 14, borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: '#ffe3f1' }} />
                  <div>
                    <div style={{ fontWeight: 900, color: '#AD1457' }}>{b.name || 'ไม่ระบุชื่อ'}</div>
                    <div style={{ color: '#64748b', fontSize: 13 }}>วันที่ {dayjs(dateStr).format('DD MMM YYYY')}</div>
                  </div>
                </div>

                <div style={{ padding: 12 }}>
                  {avail.length === 0 ? (
                    <div style={{ color: '#64748b', fontStyle: 'italic' }}>— ไม่มีเวลาว่างตามช่วงที่เลือก —</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {avail.map(t => (
                        <span
                          key={t}
                          title={`ว่าง ${t} – ${dayjs(`${dateStr} ${t}`).add(durationHours * SLOT_MIN, 'minute').format('HH:mm')}`}
                          style={chip}
                        >
                          {renderRange(t)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div style={{ display: 'grid', placeItems: 'center', marginTop: 20 }}>
          <Link href="/booking" style={bigCTA}>จองคิว</Link>
        </div>
      </section>
    </div>
  );
}

/* ---------- UI bits ---------- */
const btn: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 10,
  border: '1px solid #e2e8f0',
  color: '#0f172a',
  fontWeight: 700,
  textDecoration: 'none',
  background: '#fff'
};

const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  border: '1px solid #eef2f7',
  boxShadow: '0 6px 24px rgba(2,6,23,.05)',
  display: 'grid'
};

const inputNarrow: React.CSSProperties = {
  width: '100%',
  height: 44,
  marginTop: 6,
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #ffd6ec',
  background: '#fff'
};

const chip: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 999,
  border: '1px solid #ffd6ec',
  background: '#fff',
  fontWeight: 700,
  color: '#0f172a',
  fontSize: 14
};

const bigCTA: React.CSSProperties = {
  padding: '12px 20px',
  borderRadius: 12,
  border: '1px solid transparent',
  background: 'linear-gradient(135deg,#ff7ac8,#b07cff)',
  color: '#fff',
  fontWeight: 900,
  textDecoration: 'none',
  minWidth: 220,
  textAlign: 'center',
  boxShadow: '0 10px 24px rgba(176,124,255,.25)'
};
