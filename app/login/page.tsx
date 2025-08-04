"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "123456"; // เปลี่ยนรหัสผ่านนี้ในโปรดักชัน

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      // เก็บสถานะล็อกอินใน localStorage
      localStorage.setItem("isAdmin", "true");
      router.push("/");
    } else {
      setError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #ffb6d5 0%, #ffd6ec 100%)",
        fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif"
      }}
    >
      <div
        style={{
          background: "rgba(255,255,255,0.96)",
          padding: 40,
          borderRadius: 18,
          boxShadow: "0 8px 32px rgba(255,182,213,0.10)",
          minWidth: 340,
          maxWidth: 360,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center"
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, #ffb6d5 60%, #ffd6ec 100%)",
            borderRadius: "50%",
            width: 64,
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 18,
            boxShadow: "0 2px 8px rgba(255,182,213,0.10)"
          }}
        >
          <svg width="36" height="36" fill="none" viewBox="0 0 24 24">
            <rect width="24" height="24" rx="12" fill="#fff" opacity="0.15"/>
            <path d="M12 13.5c2.485 0 7.5 1.243 7.5 3.75V19H4.5v-1.75c0-2.507 5.015-3.75 7.5-3.75Zm0-1.5a3.75 3.75 0 1 1 0-7.5 3.75 3.75 0 0 1 0 7.5Z" fill="#ff69b4"/>
          </svg>
        </div>
        <h2
          style={{
            fontSize: 28,
            fontWeight: 800,
            marginBottom: 10,
            textAlign: "center",
            color: "#c2185b",
            letterSpacing: "-1px"
          }}
        >
          เข้าสู่ระบบแอดมิน
        </h2>
        <p style={{ color: "#b85c8a", marginBottom: 28, fontSize: 15, textAlign: "center" }}>
          โปรดกรอกข้อมูลเพื่อเข้าสู่ระบบ
        </p>
        <form
          onSubmit={handleLogin}
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 18
          }}
        >
          <div>
            <label style={{ fontWeight: 600, color: "#ff69b4", fontSize: 15 }}>
              ชื่อผู้ใช้
            </label>
            <div style={{
              display: "flex",
              alignItems: "center",
              background: "#fff0f6",
              borderRadius: 8,
              border: "1px solid #ffd6ec",
              marginTop: 6,
              padding: "0 10px"
            }}>
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" style={{opacity:0.6}}>
                <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5Z" fill="#ff69b4"/>
              </svg>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 8px",
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: 16
                }}
                autoFocus
                placeholder="admin"
              />
            </div>
          </div>
          <div>
            <label style={{ fontWeight: 600, color: "#ff69b4", fontSize: 15 }}>
              รหัสผ่าน
            </label>
            <div style={{
              display: "flex",
              alignItems: "center",
              background: "#fff0f6",
              borderRadius: 8,
              border: "1px solid #ffd6ec",
              marginTop: 6,
              padding: "0 10px"
            }}>
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" style={{opacity:0.6}}>
                <path d="M17 9V7a5 5 0 0 0-10 0v2a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2Zm-8-2a3 3 0 1 1 6 0v2H9V7Zm8 11H7v-7h10v7Zm-5-3a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="#ff69b4"/>
              </svg>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 8px",
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: 16
                }}
                placeholder="รหัสผ่าน"
              />
            </div>
          </div>
          {error && (
            <div style={{
              color: "#e63946",
              background: "#ffeaea",
              borderRadius: 6,
              padding: "8px 0",
              textAlign: "center",
              fontWeight: 500,
              fontSize: 15
            }}>
              {error}
            </div>
          )}
          <button
            type="submit"
            style={{
              width: "100%",
              padding: "12px 0",
              background: "linear-gradient(90deg, #ff69b4 60%, #ffd6ec 100%)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 18,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(255,182,213,0.10)",
              transition: "background 0.2s"
            }}
          >
            เข้าสู่ระบบ
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
