// app/nail-home/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { database, ref, onValue, push, set } from "../lib/firebase";

// ===== CONFIG =====
const LOGO_SIZE = 80;

type Review = { name: string; text: string; createdAt: number };

// รูปบริการ (เหมือนเดิม)
const services = [
  { title: "ทำเล็บมือ (ตัดแต่ง + ทาสี)", desc: "เก็บทรง ตัดหนัง ทาเจลเงาวิ้ง", img: "/nail/basic.JPG", alt: "ทำเล็บมือ" },
  { title: "ทำเล็บเท้า", desc: "สปาเท้า + ตัดแต่ง + ทาสีตามใจ", img: "/nail/n5.jpg", alt: "ทำเล็บเท้า" },
  { title: "ต่อเล็บเจล/อะคริลิค", desc: "ต่อทรงธรรมชาติ แข็งแรง อยู่ทน", img: "/nail/nail.jpg", alt: "ต่อเล็บ" },
  { title: "เพ้นท์ลาย", desc: "มินิมอล / หวาน ๆ / ฟรุ้งฟริ้ง เลือกได้", img: "/nail/wqw.jpg", alt: "เพ้นท์เล็บ" },
  { title: "ถอด/ล้างเจล", desc: "ถอดอย่างถูกวิธี ไม่ทำร้ายหน้าเล็บ", img: "/nail/tq.JPG", alt: "ถอดเจล" },
  { title: "สปามือ/สปาเท้า", desc: "สครับ + มาสก์ ผิวนุ่มชุ่มชื่น", img: "/nail/wwww.jpg", alt: "สปามือ/เท้า" },
];

const features = [
  { title: "อุปกรณ์สะอาด", desc: "ฆ่าเชื้อทุกครั้งก่อนให้บริการ", emoji: "🧴" },
  { title: "โทนสีแน่น",   desc: "แบรนด์เจลพรีเมียมติดทนนาน", emoji: "🎀" },
  { title: "ช่างมือเบา",  desc: "ชำนาญ ใส่ใจทุกรายละเอียด",  emoji: "🪄" },
  
];

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  border: "1px solid #eef2f7",
  boxShadow: "0 6px 24px rgba(2,6,23,.05)",
};

// ===== Reviews slider =====
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
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
                {reviews.slice(i * perPage, i * perPage + perPage).map((rv, idx) => (
                  <li
                    key={`${i}-${idx}-${rv.name}`}
                    style={{
                      background: "#fff7fb",
                      border: "1px solid #ffd6ec",
                      borderRadius: 12,
                      padding: "12px 14px",
                    }}
                  >
                    <div style={{ fontWeight: 800, marginBottom: 4, color: "#c2185b" }}>{rv.name}</div>
                    <div style={{ color: "#475569", whiteSpace: "pre-wrap" }}>{rv.text}</div>
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

// ===== Map config (embed + fallback) =====
const MAP_EMBED_PB = ""; // ถ้ามีโค้ด pb จาก "ฝังแผนที่" วางแทนได้เลย
const MAP_QUERY =
  "X4JF+353 ซอย พายัพทิศ 9/11 ตำบลในเมือง อำเภอเมืองนครราชสีมา นครราชสีมา 30000";
const MAP_LINK = "https://maps.app.goo.gl/pXCb7vJLJs5dhNmE8";
const MAP_SRC = MAP_EMBED_PB
  ? `https://www.google.com/maps/embed?pb=${MAP_EMBED_PB}`
  : `https://www.google.com/maps?q=${encodeURIComponent(MAP_QUERY)}&z=17&hl=th&output=embed`;

export default function NailHomePage() {
  // -------- รีวิว (โหลด/ส่ง) --------
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rvName, setRvName] = useState("");
  const [rvText, setRvText] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onValue(ref(database, "reviews"), (snap) => {
      const val = snap.val() || {};
      const list: Review[] = Object.values(val);
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
      await set(newRef, { name, text, createdAt: Date.now() });
      setRvName(""); setRvText("");
      setMsg("ขอบคุณสำหรับรีวิวค่ะ ✨");
    } catch {
      setMsg("บันทึกไม่สำเร็จ ลองอีกครั้งค่ะ");
    } finally {
      setSending(false);
    }
  };

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
          position: "sticky", top: 0, zIndex: 10,
          backdropFilter: "saturate(180%) blur(6px)",
          background: "rgba(255,255,255,.7)",
          borderBottom: "1px solid #f1f5f9",
        }}
      >
        <div
          style={{
            maxWidth: 1100, margin: "0 auto", padding: "14px 16px",
            display: "flex", alignItems: "center", gap: 14,
          }}
        >
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "#0f172a" }}>
            <Image src="/logo.png" alt="Nailties logo" width={LOGO_SIZE} height={LOGO_SIZE} style={{ borderRadius: 10 }} priority />
            <span style={{ fontWeight: 900, letterSpacing: 0.2, fontSize: 22 }}>Nailties</span>
          </Link>

          <nav style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            <Link href="/booking" style={primaryBtn}>จองคิว</Link>
            <a href="#services" style={navBtn}>บริการ</a>
            <Link href="/login" style={navBtn}>Login</Link>
          </nav>
        </div>
      </header>

      {/* ===== HERO (รูปซ้าย / ข้อความขวา) ===== */}
      <section className="hero">
        {/* รูปโปรโมชัน (ซ้าย) */}
        <div className="hero-visual">
          <div style={{ ...card, padding: 0, overflow: "hidden" }}>
            <Image
              src="/pic.jpg"
              alt="โปรโมชันร้านทำเล็บ"
              width={1080}
              height={1080}
              style={{ width: "100%", height: "auto", display: "block" }} // แสดงเต็ม ไม่ครอป
              priority
            />
          </div>
        </div>

        {/* ข้อความ (ขวา) */}
        <div className="hero-copy">
          <h1 style={{ fontSize: 44, lineHeight: 1.12, margin: "0 0 14px", fontWeight: 900, letterSpacing: -0.5, color: "#c2185b" }}>
            สวยวิ้งทุกปลายนิ้ว
            <br />โทนหวานพาสเทลตามใจคุณ
          </h1>
          <p style={{ color: "#475569", fontSize: 18, marginBottom: 20, maxWidth: 560 }}>
            เลือกโทนสี ลาย และรูปทรงได้ตามต้องการ — วัสดุพรีเมียม มือเบา ใส่ใจรายละเอียด พร้อมบรรยากาศชิลล์ ๆ ให้คุณผ่อนคลาย
          </p>
          <div style={{ display: "flex", gap: 12 }}>
            <Link href="/booking" style={ctaPrimary}>จองคิวตอนนี้</Link>
            <a href="#services" style={ctaGhost}>ดูบริการ</a>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 18, color: "#475569", fontWeight: 600 }}>
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

  /* mobile: ข้อความก่อน รูปทีหลัง */
  .hero-copy { order: 1; }
  .hero-visual { order: 2; }

  @media (min-width: 980px) {
    /* desktop: ข้อความซ้าย (.9) / รูปขวา (1.1) */
    .hero { grid-template-columns: .9fr 1.1fr; }
    .hero-copy { order: 1; }   /* ซ้าย */
    .hero-visual { order: 2; } /* ขวา */
  }
`}</style>

      </section>

      {/* Features */}
      <section style={{ maxWidth: 1100, margin: "20px auto 0", padding: "0 16px" }}>
        <div style={{ ...card, padding: 18 }}>
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

      {/* Services */}
      <section id="services" style={{ maxWidth: 1100, margin: "26px auto", padding: "0 16px" }}>
        <h2 style={{ fontSize: 26, fontWeight: 900, margin: "0 0 14px" }}>บริการ</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 16 }}>
          {services.map((s) => (
            <div key={s.title} style={{ ...card, padding: 0, overflow: "hidden" }}>
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

      {/* ===== Reviews + Map (อยู่ข้างกัน) ===== */}
      <section className="duo">
        {/* รีวิว (ซ้าย) */}
        <div style={{ ...card, padding: 18 }}>
          <div style={{ fontSize: 16, color: "#334155", fontWeight: 800, marginBottom: 12 }}>
            รีวิวจากลูกค้า
          </div>
          <ReviewsSlider reviews={reviews} />
        </div>

        {/* แผนที่ (ขวา) */}
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
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

      {/* Review Form */}
      <section id="write-review" style={{ maxWidth: 1100, margin: "26px auto 0", padding: "0 16px" }}>
        <div style={{ ...card, padding: 24, background: "linear-gradient(135deg,#ffe4f3 0%,#efe9ff 100%)" }}>
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <h2 style={{ margin: "4px 0 16px", fontSize: 22, fontWeight: 900, color: "#c2185b" }}>
              เขียนรีวิวของคุณ
            </h2>

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

      {/* Footer */}
      <footer style={{ borderTop: "1px solid #f1f5f9", padding: "16px 0", textAlign: "center", color: "#64748b", fontSize: 14 }}>
        © {new Date().getFullYear()} Nail Studio — All rights reserved.
      </footer>
    </div>
  );
}

/* ===== Buttons & chips ===== */
const navBtn: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  color: "#0f172a",
  fontWeight: 700,
  textDecoration: "none",
  background: "#fff",
};

const primaryBtn: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 10,
  border: "1px solid transparent",
  background: "linear-gradient(135deg,#ff7ac8,#b07cff)",
  color: "#fff",
  fontWeight: 800,
  textDecoration: "none",
};

const ctaPrimary: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 12,
  border: "none",
  background: "linear-gradient(135deg,#ff7ac8,#b07cff)",
  color: "#fff",
  fontWeight: 900,
  textDecoration: "none",
  boxShadow: "0 8px 20px rgba(176,124,255,.25)",
};

const ctaGhost: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  color: "#0f172a",
  fontWeight: 900,
  textDecoration: "none",
  background: "#fff",
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
