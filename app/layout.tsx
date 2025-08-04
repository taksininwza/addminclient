// app/layout.tsx
import React from "react";
import "./globals.css"; // ถ้ามี global style

export const metadata = {
  title: "My App",
  description: "My Next.js Application",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
