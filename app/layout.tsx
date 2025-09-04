
import React from "react";
import "./globals.css"; // ถ้ามี global style

export const metadata = {
  title: {
    default: 'Nailties',
    template: '%s | Nailties',
  },
  applicationName: 'Nailties',
  
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/icon-192.png',
  },
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
