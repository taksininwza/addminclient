// app/nail-home/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import dayjs from "dayjs";
import { createPortal } from "react-dom";
import { database, ref, onValue, push, set } from "../lib/firebase";

/* ================== CONFIG & STYLES ================== */
const LOGO_SIZE = 80;

const LINE_ADD_FRIEND_URL =
  process.env.NEXT_PUBLIC_LINE_ADD_FRIEND_URL ??
  "https://line.me/R/ti/p/@978tofxe";

const navBtn: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  color: "#0f172a",
  fontWeight: 700,
  textDecoration: "none",
  background: "#fff",
};

// ปุ่มหลักสำหรับ "จองคิว"
const primaryBtn: React.CSSProperties = {
  padding: "16px 22px",
  fontSize: 32,
  lineHeight: 1.1,
  borderRadius: 14,
  border: "1px solid transparent",
  background: "linear-gradient(135deg,#ff7ac8,#b07cff)",
  color: "#fff",
  fontWeight: 900,
  textDecoration: "none",
  boxShadow: "0 8px 20px rgba(176,124,255,.25)",
  display: "inline-block",
  transition: "transform .15s ease, box-shadow .15s ease, filter .15s ease",
};

const badge: React.CSSProperties = {
  background: "#ffe4f3",
  border: "1px solid #ffd6ec",
  color: "#c2185b",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
};
const cardstyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  border: "1px solid #eef2f7",
  boxShadow: "0 6px 24px rgba(2,6,23,.05)",
};

/* ================== TYPES ================== */
type AdminReply = { text: string; updatedAt?: number };
type Review = {
  name: string;
  text: string;
  createdAt: number;
  rating?: number;          // 1..5 (ถ้าไม่มี จะถือเป็น 5)
  adminReply?: AdminReply;  // { text, updatedAt? }
};

type Promo = {
  title: string;
  subtitle?: string;
  discountPercent?: number;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  active: boolean;
  imageUrl?: string;
};

/* ================== STATIC CONTENT ================== */
const services = [
  { title: "ทำเล็บมือ (ตัดแต่ง + ทาสี)", desc: "เก็บทรง ตัดหนัง ทาเจลเงาวิ้ง", img: "/nail/basic.JPG", alt: "ทำเล็บมือ" },
  { title: "ทำเล็บเท้า", desc: "สปาเท้า + ตัดแต่ง + ทาสีตามใจ", img: "/nail/n5.jpg", alt: "ทำเล็บเท้า" },
  { title: "ต่อเล็บเจล/อะคริลิค", desc: "ต่อทรงธรรมชาติ แข็งแรง อยู่ทน", img: "/nail/nail.jpg", alt: "ต่อเล็บ" },
  { title: "เพ้นท์ลาย", desc: "มินิมอล / หวาน ๆ / ฟรุ้งฟริ้ง เลือกได้", img: "/nail/wqw.jpg", alt: "เพ้นท์เล็บ" },
  { title: "ถอด/ล้างเจล", desc: "ถอดอย่างถูกวิธี ไม่ทำร้ายหน้าเล็บ", img: "/nail/tq.JPG", alt: "ถอดเจล" },
  { title: "สปามือ/สปาเท้า", desc: "สครับ + มาสก์ ผิวนุ่มชุ่มชื่น", img: "/nail/wwww.jpg", alt: "สปามือ/เท้า" },
];

/* ================== UTILS ================== */
const toBool = (v: any) => v === true || v === "true" || v === 1 || v === "1";

/* ============== CTA Button (Hover ด้วย state) ============== */
function CtaLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);

  const hoverStyle: React.CSSProperties = hovered
    ? {
        transform: "translateY(-2px)",
        filter: "brightness(1.06)",
        boxShadow: "0 16px 34px rgba(176,124,255,.35)",
      }
    : {};

  return (
    <Link
      href={href}
      style={{ ...primaryBtn, ...hoverStyle }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      {children}
    </Link>
  );
}

/* ============== Stars ============== */
function Stars({ value = 5 }: { value?: number }) {
  const v = Math.max(1, Math.min(5, Math.round(value)));
  return (
    <div aria-label={`${v} stars`} style={{ display: "inline-flex", gap: 2 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill={i < v ? "#f59e0b" : "#e5e7eb"}
          aria-hidden="true"
        >
          <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
        </svg>
      ))}
    </div>
  );
}

/* ================== SUB-COMPONENTS ================== */
function ReviewsSlider({ reviews }: { reviews: Review[] }) {
  const perPage = 3;
  const pages = Math.max(1, Math.ceil(reviews.length / perPage));
  const [page, setPage] = React.useState(0);

  React.useEffect(() => {
    if (page >= pages) setPage(pages - 1);
  }, [pages, page]);

  if (reviews.length === 0) {
    return <div style={{ color: "#64748b" }}>ยังไม่มีรีวิว</div>;
  }

  return (
    <div style={{ position: "relative" }}>
      <div style={{ overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            width: `${pages * 100}%`,
            transform: `translateX(-${page * 100}%)`,
            transition: "transform .4s ease",
          }}
        >
          {Array.from({ length: pages }).map((_, i) => (
            <div key={i} style={{ flex: "0 0 100%" }}>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "grid",
                  gap: 12,
                }}
              >
                {reviews.slice(i * perPage, i * perPage + perPage).map((rv, idx) => (
                  <li
                    key={`${i}-${idx}-${rv.name}`}
                    style={{
                      background: "#fff7fb",
                      border: "1px solid #ffd6ec",
                      borderRadius: 12,
                      padding: "12px 14px",
                      overflow: "hidden",
                    }}
                  >
                  {/* header: name + stars (inline) */}
<div
  style={{
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
    minWidth: 0, // กันล้น
  }}
>
  <div
    style={{
      fontWeight: 800,
      color: "#c2185b",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      minWidth: 0,
      flex: "0 1 auto",
    }}
    title={rv.name}
  >
    {rv.name}
  </div>
  <Stars value={rv.rating ?? 5} />
</div>


                    {/* customer text */}
                    <div
                      style={{
                        color: "#475569",
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                        wordBreak: "break-word",
                        lineHeight: 1.45,
                      }}
                    >
                      {rv.text}
                    </div>

                    {/* admin reply */}
                    {rv.adminReply?.text ? (
                      <div
                        style={{
                          marginTop: 10,
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: "1px dashed #ffd6ec",
                          background: "#fff0f6",
                          color: "#334155",
                          overflowWrap: "anywhere",
                          wordBreak: "break-word",
                        }}
                      >
                        <div style={{ fontWeight: 900, color: "#AD1457", marginBottom: 4 }}>
                          คำตอบจากแอดมิน
                        </div>
                        <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
                          {rv.adminReply.text}
                        </div>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* dots */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 10 }}>
        {Array.from({ length: pages }).map((_, i) => (
          <button
            key={i}
            onClick={() => setPage(i)}
            aria-label={`ไปหน้า ${i + 1}`}
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              border: "none",
              background: i === page ? "linear-gradient(135deg,#ff7ac8,#b07cff)" : "#eadcf8",
              transform: i === page ? "scale(1.2)" : "scale(1)",
              cursor: "pointer",
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** แถบโปรโมชันแบบข้อความเลื่อน */
function PromoMarquee({ promo }: { promo: Promo }) {
  if (!promo.active) return null;

  const DURATION_SEC = 35;
  const REPEAT = 3;

  const range =
    promo.startDate || promo.endDate
      ? `${promo.startDate ? dayjs(promo.startDate).format("D MMM YYYY") : "วันนี้"} – ${promo.endDate ? dayjs(promo.endDate).format("D MMM YYYY") : "สิ้นสุดโปรฯ"}`
      : "";

  const parts = [
    typeof promo.discountPercent === "number" && !Number.isNaN(promo.discountPercent) ? `ลด ${promo.discountPercent}%` : null,
    promo.title || null,
    promo.subtitle || null,
    range || null,
  ].filter(Boolean) as string[];

  const segment = `✨ ${parts.join(" • ")} ✨`;
  const groupItems = Array.from({ length: REPEAT }, () => segment);

  return (
    <section style={{ maxWidth: 1100, margin: "18px auto 0", padding: "0 16px" }}>
      <div className="promo-marquee" aria-label="ประกาศโปรโมชัน">
        <div className="promo-track" style={{ ["--dur" as any]: `${DURATION_SEC}s` }}>
          <div className="promo-group">
            {groupItems.map((txt, i) => (
              <span key={i} className="promo-item">
                {txt}
              </span>
            ))}
          </div>
          <div className="promo-group" aria-hidden="true">
            {groupItems.map((txt, i) => (
              <span key={`dup-${i}`} className="promo-item">
                {txt}
              </span>
            ))}
          </div>
        </div>
      </div>

      <style jsx global>{`
        .promo-marquee {
          overflow: hidden;
          border-radius: 18px;
          border: 1px solid #ffd6ec;
          background: linear-gradient(135deg, rgba(255, 122, 200, 0.12), rgba(176, 124, 255, 0.18));
          box-shadow: 0 12px 36px rgba(173, 20, 87, 0.12);
          padding: 10px 0;
          -webkit-mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent);
          mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent);
        }
        .promo-track {
          display: inline-flex;
          white-space: nowrap;
          will-change: transform;
          animation: promo-marquee-slide var(--dur, 60s) linear infinite;
        }
        .promo-group {
          flex: 0 0 100%;
          min-width: 100%;
          display: inline-flex;
          justify-content: center;
          gap: 28px;
          padding: 0 12px;
        }
        .promo-item {
          color: #c2185b;
          font-weight: 900;
          letter-spacing: 0.2px;
          white-space: nowrap;
        }
        @keyframes promo-marquee-slide {
          from { transform: translate3d(0, 0, 0); }
          to   { transform: translate3d(-50%, 0, 0); }
        }
      `}</style>
    </section>
  );
}

/* ============== Floating LINE Button (Portal to <body>) ============== */
function FloatingLineButton({ href }: { href: string }) {
  const [mounted, setMounted] = useState(false);
  const [showHint, setShowHint] = useState(true);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted) return;
    const t = setTimeout(() => setShowHint(false), 6000);
    return () => clearTimeout(t);
  }, [mounted]);
  if (!mounted) return null;

  const css = `
    .floating-line {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 1000;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      border-radius: 999px;
      background: #06c755;
      border: 2px solid #06c755;
      color: #fff;
      text-decoration: none;
      font-weight: 900;
      letter-spacing: .2px;
      box-shadow: 0 12px 28px rgba(6,199,85,.35);
      transition: transform .12s ease, box-shadow .12s ease, filter .12s ease;
    }
    .floating-line .icon { display: grid; place-items: center; }
    .floating-line .label { white-space: nowrap; font-size: 14px; line-height: 1; }
    .floating-line:hover, .floating-line:focus-visible {
      filter: brightness(1.03);
      transform: translateY(-1px);
      box-shadow: 0 16px 32px rgba(6,199,85,.42);
    }
    .floating-line-hint {
      position: fixed;
      right: 16px;
      bottom: 76px;
      z-index: 1000;
      background: #ffffff;
      color: #0f172a;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 10px 12px;
      font-weight: 900;
      box-shadow: 0 12px 30px rgba(15,23,42,.15);
      display: inline-flex;
      align-items: center;
      gap: 8px;
      animation: hint-pop .28s ease-out, hint-pulse 2.5s ease-in-out infinite;
    }
    .floating-line-hint::after{
      content: "";
      position: absolute;
      right: 22px;
      bottom: -6px;
      width: 12px; height: 12px;
      background: #fff;
      border-left: 1px solid #e2e8f0;
      border-bottom: 1px solid #e2e8f0;
      transform: rotate(45deg);
    }
    .hint-close{
      margin-left: 2px;
      background: transparent;
      border: 0;
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      color: #64748b;
    }
    @keyframes hint-pop { from { transform: translateY(6px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes hint-pulse { 0%,100%{ box-shadow:0 12px 30px rgba(15,23,42,.15);} 50%{ box-shadow:0 16px 36px rgba(6,199,85,.25);} }
    @supports (bottom: env(safe-area-inset-bottom)) {
      .floating-line { right: max(16px, env(safe-area-inset-right)); bottom: calc(16px + env(safe-area-inset-bottom)); }
      .floating-line-hint { right: max(16px, env(safe-area-inset-right)); bottom: calc(76px + env(safe-area-inset-bottom)); }
    }
    @media (max-width: 420px) {
      .floating-line { padding: 12px; }
      .floating-line .label { display: none; }
      .floating-line-hint { font-size: 13px; }
    }
  `;

  return createPortal(
    <>
      {showHint && (
        <div className="floating-line-hint" role="status" aria-live="polite">
          จองผ่าน LINE เพื่อรับการแจ้งเตือนและสะสมแต้ม
          <button className="hint-close" aria-label="ปิด" onClick={() => setShowHint(false)}>
            ×
          </button>
        </div>
      )}
      <a
        href={href}
        className="floating-line"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="เพิ่มเพื่อน LINE"
        title="เพิ่มเพื่อน LINE"
      >
        <span className="icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 36 36" fill="none" role="img">
            <path
              fill="#fff"
              d="M18 3C9.72 3 3 8.82 3 15.99c0 3.96 2.16 7.5 5.52 9.9-.18.66-.96 3.6-1.02 3.96 0 0-.03.27.15.39.18.12.39.03.39.03.51-.07 3.33-2.19 3.84-2.58.66.12 1.35.18 2.07.18 8.28 0 15-5.82 15-12.99C29.94 8.82 27.72 3 18 3Z"
            />
          </svg>
        </span>
        <span className="label">เพิ่มเพื่อน LINE</span>
      </a>
      <style dangerouslySetInnerHTML={{ __html: css }} />
    </>,
    document.body
  );
}

/* ================== MAP CONFIG ================== */
const MAP_EMBED_PB = "";
const MAP_QUERY =
  "X4JF+353 ซอย พายัพทิศ 9/11 ตำบลในเมือง อำเภอเมืองนครราชสีมา นครราชสีมา 30000";
const MAP_LINK = "https://maps.app.goo.gl/pXCb7vJLJs5dhNmE8";
const MAP_SRC = MAP_EMBED_PB
  ? `https://www.google.com/maps/embed?pb=${MAP_EMBED_PB}`
  : `https://www.google.com/maps?q=${encodeURIComponent(MAP_QUERY)}&z=17&hl=th&output=embed`;

/* ================== PAGE ================== */
export default function NailHomePage() {
  // -------- โปรโมชันจาก Admin --------
  const [promo, setPromo] = useState<Promo>({
    title: "",
    subtitle: "",
    discountPercent: undefined,
    startDate: "",
    endDate: "",
    active: false,
    imageUrl: "/pic.jpg",
  });

  useEffect(() => {
    const unsub = onValue(ref(database, "promotions/current"), (snap) => {
      const raw = (snap.val() || {}) as any;
      setPromo({
        title: raw.title ?? "",
        subtitle: raw.subtitle ?? "",
        discountPercent: typeof raw.discountPercent === "number" ? raw.discountPercent : Number(raw.discountPercent) || undefined,
        startDate: raw.startDate || "",
        endDate: raw.endDate || "",
        active: toBool(raw.active),
        imageUrl: raw.bannerUrl || raw.imageUrl || "/pic.jpg",
      });
    });
    return () => unsub();
  }, []);

  // -------- รีวิว (โหลด/ส่ง) --------
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rvName, setRvName] = useState("");
  const [rvText, setRvText] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onValue(ref(database, "reviews"), (snap) => {
      const val = snap.val() || {};
      const list: Review[] = Object.values(val).map((r: any) => ({
        name: r?.name ?? "-",
        text: r?.text ?? "",
        createdAt: Number(r?.createdAt) || 0,
        rating: typeof r?.rating === "number" ? r.rating : undefined, // แสดงถ้ามี
        adminReply: r?.adminReply?.text
          ? { text: String(r.adminReply.text), updatedAt: Number(r.adminReply?.updatedAt) || undefined }
          : undefined,
      }));
      list.sort((a, b) => b.createdAt - a.createdAt);
      setReviews(list);
    });
    return () => unsub();
  }, []);

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const name = rvName.trim().slice(0, 40);
    const text = rvText.trim().slice(0, 300);
    if (!name || text.length < 5) {
      setMsg("กรุณากรอกชื่อและรีวิวอย่างน้อย 5 ตัวอักษร");
      return;
    }
    try {
      setSending(true);
      const newRef = push(ref(database, "reviews"));
      // ถ้าไม่ได้ให้เลือกดาวที่หน้าเว็บนี้ จะไม่ส่ง rating (ระบบจะถือเป็น 5 ตอนแสดงผล)
      await set(newRef, { name, text, createdAt: Date.now() });
      setRvName("");
      setRvText("");
      setMsg("ขอบคุณสำหรับรีวิวค่ะ ✨");
    } catch {
      setMsg("บันทึกไม่สำเร็จ ลองอีกครั้งค่ะ");
    } finally {
      setSending(false);
    }
  };

  // -------- นับ "จำนวนการจองทั้งหมด" (รวมหมด) --------
  const [resCount, setResCount] = useState(0);
  const [payCount, setPayCount] = useState(0);

  useEffect(() => {
    const unsubRes = onValue(ref(database, "reservations"), (snap) => {
      const val = snap.val() || {};
      setResCount(Object.keys(val).length);
    });
    const unsubPay = onValue(ref(database, "payments"), (snap) => {
      const val = snap.val() || {};
      setPayCount(Object.keys(val).length);
    });
    return () => {
      unsubRes();
      unsubPay();
    };
  }, []);

  const totalBookings = resCount + payCount;

  // การ์ด “ทำไมต้อง Nailties?”
  const features = useMemo(
    () => [
      { title: "อุปกรณ์สะอาด", desc: "ฆ่าเชื้อทุกครั้งก่อนให้บริการ", emoji: "🧴" },
      { title: "โทนสีแน่น", desc: "แบรนด์เจลพรีเมียมติดทนนาน", emoji: "🎀" },
      { title: "ช่างมือเบา", desc: "ชำนาญ ใส่ใจทุกรายละเอียด", emoji: "🪄" },
      { title: "ผู้มาใช้บริการ", desc: `${totalBookings} คน`, emoji: "👤" },
    ],
    [totalBookings]
  );

  const heroImage = promo.imageUrl || "/pic.jpg";

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1200px 600px at 10% -10%, #ffe4f3 0%, transparent 60%), radial-gradient(900px 500px at 90% 0%, #e9e7ff 0%, transparent 50%), #ffffff",
        fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Arial, sans-serif",
        color: "#0f172a",
      }}
    >
      {/* Top Bar */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          backdropFilter: "saturate(180%) blur(6px)",
          background: "rgba(255,255,255,.7)",
          borderBottom: "1px solid #f1f5f9",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "#0f172a" }}>
            <Image src="/logo.png" alt="Nailties logo" width={LOGO_SIZE} height={LOGO_SIZE} style={{ borderRadius: 10 }} priority />
            <span style={{ fontWeight: 900, letterSpacing: 0.2, fontSize: 22 }}>Nailties</span>
          </Link>

          <nav style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            <a href="#" style={navBtn}>Home</a>
            <Link href="/availability" style={navBtn}>queue</Link>
            <Link href="/login" style={navBtn}>Login</Link>
          </nav>
        </div>
      </header>

      {/* ===== HERO ===== */}
      <section className="hero">
        <div className="hero-visual">
          <div style={{ ...cardstyle, padding: 0, overflow: "hidden" }}>
            <Image
              src={heroImage}
              alt="ภาพหน้าร้าน/ธีม"
              width={1080}
              height={1080}
              style={{ width: "100%", height: "auto", display: "block" }}
              priority
            />
          </div>
        </div>

        <div className="hero-copy">
          <h1 style={{ fontSize: 44, lineHeight: 1.12, margin: "0 0 14px", fontWeight: 900, letterSpacing: -0.5, color: "#c2185b" }}>
            สวยวิ้งทุกปลายนิ้ว
            <br />โทนหวานพาสเทลตามใจคุณ
          </h1>
          <p style={{ color: "#475569", fontSize: 18, marginBottom: 0, maxWidth: 560 }}>
            เลือกโทนสี ลาย และรูปทรงได้ตามต้องการ — วัสดุพรีเมียม มือเบา ใส่ใจรายละเอียด พร้อมบรรยากาศชิลล์ ๆ ให้คุณผ่อนคลาย
          </p>

          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 16, flexWrap: "wrap" }}>
            <CtaLink href="/booking">จองคิว</CtaLink>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 14, color: "#475569", fontWeight: 600, flexWrap: "wrap" }}>
            <span style={badge}>อุปกรณ์สะอาด</span>
            <span style={badge}>สีติดทน</span>
          </div>
        </div>

        <style jsx>{`
          .hero {
            max-width: 1100px;
            margin: 40px auto 10px;
            padding: 0 16px;
            display: grid;
            grid-template-columns: 1fr;
            gap: 26px;
            align-items: center;
          }
          .hero-copy { order: 1; }
          .hero-visual { order: 2; }
          @media (min-width: 980px) {
            .hero { grid-template-columns: .9fr 1.1fr; }
            .hero-copy { order: 1; }
            .hero-visual { order: 2; }
          }
        `}</style>
      </section>

      {/* ===== Promo ===== */}
      <PromoMarquee promo={promo} />

      {/* ===== Features ===== */}
      <section style={{ maxWidth: 1100, margin: "20px auto 0", padding: "0 16px" }}>
        <div style={{ ...cardstyle, padding: 18 }}>
          <h2 style={{ margin: "4px 0 14px", fontSize: 22, fontWeight: 900 }}>ทำไมต้อง Nailties?</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12 }}>
            {features.map((f) => (
              <div key={f.title} style={{ border: "1px solid #eef2f7", borderRadius: 14, padding: 14, background: "#ffffff" }}>
                <div style={{ fontSize: 24 }}>{f.emoji}</div>
                <div style={{ fontWeight: 800, marginTop: 6 }}>{f.title}</div>
                <div style={{ color: "#475569", marginTop: 4 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Services ===== */}
      <section id="services" style={{ maxWidth: 1100, margin: "26px auto", padding: "0 16px" }}>
        <h2 style={{ fontSize: 26, fontWeight: 900, margin: "0 0 14px" }}>บริการ</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 16 }}>
          {services.map((s) => (
            <div key={s.title} style={{ ...cardstyle, padding: 0, overflow: "hidden" }}>
              <div style={{ position: "relative", width: "100%", height: 250 }}>
                <Image
                  src={s.img}
                  alt={s.alt || s.title}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1100px) 33vw, 360px"
                  style={{ objectFit: "cover", objectPosition: "center 12%" }}
                />
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ fontWeight: 900 }}>{s.title}</div>
                <div style={{ color: "#475569", marginTop: 4 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Reviews + Map ===== */}
      <section className="duo">
        <div style={{ ...cardstyle, padding: 18 }}>
          <div style={{ fontSize: 16, color: "#334155", fontWeight: 800, marginBottom: 12 }}>รีวิวจากลูกค้า</div>
          <ReviewsSlider reviews={reviews} />
        </div>

        <div style={{ ...cardstyle, padding: 0, overflow: "hidden" }}>
          <div style={{ position: "relative", width: "100%", height: "clamp(260px, 45vh, 480px)" }}>
            <iframe
              src={MAP_SRC}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              title="แผนที่ร้าน"
            />
            <a
              href={MAP_LINK}
              target="_blank"
              rel="noreferrer"
              style={{
                position: "absolute",
                right: 12,
                bottom: 12,
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                background: "rgba(255,255,255,.92)",
                color: "#0f172a",
                fontWeight: 700,
                textDecoration: "none",
                boxShadow: "0 2px 8px rgba(0,0,0,.06)",
              }}
            >
              เปิดใน Google Maps
            </a>
          </div>
        </div>

        <style jsx>{`
          .duo {
            max-width: 1100px;
            margin: 26px auto 40px;
            padding: 0 16px;
            display: grid;
            grid-template-columns: 1fr;
            gap: 16px;
          }
          @media (min-width: 980px) {
            .duo { grid-template-columns: 1fr 1fr; }
          }
        `}</style>
      </section>

      {/* ===== Review Form ===== */}
      <section id="write-review" style={{ maxWidth: 1100, margin: "26px auto 0", padding: "0 16px" }}>
        <div style={{ ...cardstyle, padding: 24, background: "linear-gradient(135deg,#ffe4f3 0%,#efe9ff 100%)" }}>
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <h2 style={{ margin: "4px 0 16px", fontSize: 22, fontWeight: 900, color: "#c2185b" }}>เขียนรีวิวของคุณ</h2>

            <form onSubmit={submitReview} style={{ display: "grid", gap: 10 }}>
              <input
                placeholder="ชื่อของคุณ"
                value={rvName}
                onChange={(e) => setRvName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid #ffd6ec",
                  outline: "none",
                  background: "#fff",
                }}
              />
              <textarea
                placeholder="พิมพ์รีวิว (อย่างน้อย 5 ตัวอักษร)"
                value={rvText}
                onChange={(e) => setRvText(e.target.value)}
                rows={4}
                style={{
                  width: "100%",
                  minHeight: 120,
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid #ffd6ec",
                  outline: "none",
                  resize: "vertical",
                  background: "#fff",
                }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="submit"
                  disabled={sending}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 10,
                    border: "none",
                    background: "linear-gradient(135deg,#ff7ac8,#b07cff)",
                    color: "#fff",
                    fontWeight: 800,
                    cursor: "pointer",
                    minWidth: 140,
                    opacity: sending ? 0.7 : 1,
                    boxShadow: "0 6px 16px rgba(176,124,255,.25)",
                  }}
                >
                  {sending ? "กำลังส่ง..." : "ส่งรีวิว"}
                </button>
              </div>
              {msg && <div style={{ color: "#c2185b", fontWeight: 700 }}>{msg}</div>}
            </form>
          </div>
        </div>
      </section>

      {/* ===== Floating LINE Button ===== */}
      <FloatingLineButton href={LINE_ADD_FRIEND_URL} />

      {/* ===== Footer ===== */}
      <footer style={{ borderTop: "1px solid #f1f5f9", padding: "16px 0", textAlign: "center", color: "#64748b", fontSize: 14 }}>
        © {new Date().getFullYear()} Nailties Studio — All rights reserved.
      </footer>
    </div>
  );
}
