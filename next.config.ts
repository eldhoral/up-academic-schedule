import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "/" became the menu, then every schedule moved under its prodi (/s1, /s2). Old bookmarks
  // keep working and land on S1, the only prodi before S2 existed; query strings pass through.
  async redirects() {
    return [
      { source: "/", has: [{ type: "query", key: "smt" }], destination: "/s1/kuliah", permanent: false },
      { source: "/", has: [{ type: "query", key: "jenis" }], destination: "/s1/kuliah", permanent: false },
      { source: "/", has: [{ type: "query", key: "ay" }], destination: "/s1/kuliah", permanent: false },
      { source: "/kalender", destination: "/s1/kuliah/kalender", permanent: false },
      { source: "/cetak/:path*", destination: "/s1/kuliah/cetak/:path*", permanent: false },
      { source: "/rekap/:path*", destination: "/s1/kuliah/rekap/:path*", permanent: false },
      { source: "/kuliah/:path*", destination: "/s1/kuliah/:path*", permanent: false },
      { source: "/kuliah", destination: "/s1/kuliah", permanent: false },
      { source: "/ujian/:path*", destination: "/s1/ujian/:path*", permanent: false },
      { source: "/ujian", destination: "/s1/ujian", permanent: false },
      { source: "/sidang/:path*", destination: "/s1/sidang/:path*", permanent: false },
      { source: "/sidang", destination: "/s1/sidang", permanent: false },
      { source: "/mata-kuliah", destination: "/s1/mata-kuliah", permanent: false },
      { source: "/mahasiswa", destination: "/s1/mahasiswa", permanent: false },
      { source: "/sesi", destination: "/s1/sesi", permanent: false },
      { source: "/pengaturan", destination: "/s1/pengaturan", permanent: false },
    ];
  },
};

export default nextConfig;
