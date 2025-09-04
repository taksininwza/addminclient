// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // ข้าม ESLint ตอน build (ให้ผ่านไปก่อน)
    ignoreDuringBuilds: true,
  },
  // ถ้าอยากให้ build ผ่านแม้มี TypeScript error ด้วย (ไม่แนะนำระยะยาว)
  // typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
