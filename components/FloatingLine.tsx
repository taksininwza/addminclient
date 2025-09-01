'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function FloatingLine({ href }: { href: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <a
      href={href}
      className="floating-line"
      target="_blank"
      rel="noreferrer"
      aria-label="เพิ่มเพื่อน LINE"
      title="เพิ่มเพื่อน LINE"
    >
      <span className="icon" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 36 36" fill="none">
          <path
            fill="#fff"
            d="M18 3C9.72 3 3 8.82 3 15.99c0 3.96 2.16 7.5 5.52 9.9-.18.66-.96 3.6-1.02 3.96 0 0-.03.27.15.39.18.12.39.03.39.03.51-.07 3.33-2.19 3.84-2.58.66.12 1.35.18 2.07.18 8.28 0 15-5.82 15-12.99C29.94 8.82 27.72 3 18 3Z"
          />
        </svg>
      </span>
      <span className="label">เพิ่มเพื่อน LINE</span>
    </a>,
    document.body
  );
}
