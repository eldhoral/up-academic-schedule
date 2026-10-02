import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Kuliah moved under /kuliah when "/" became the menu. Old bookmarks keep working;
  // query strings pass through. The bare "/" is only redirected when it carries a
  // schedule query, so the menu itself stays at "/".
  async redirects() {
    return [
      { source: "/", has: [{ type: "query", key: "smt" }], destination: "/kuliah", permanent: true },
      { source: "/", has: [{ type: "query", key: "jenis" }], destination: "/kuliah", permanent: true },
      { source: "/", has: [{ type: "query", key: "ay" }], destination: "/kuliah", permanent: true },
      { source: "/kalender", destination: "/kuliah/kalender", permanent: true },
      { source: "/cetak/:path*", destination: "/kuliah/cetak/:path*", permanent: true },
      { source: "/rekap/:path*", destination: "/kuliah/rekap/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
