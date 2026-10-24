import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // Kamera og mikrofon må kun bruges af Relived selv (studiet).
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      { source: "/kassen", destination: "/kurv", permanent: false },
      // Siden hed /om-snuplive, før navnet blev Relived.
      { source: "/om-snuplive", destination: "/om-relived", permanent: true },
    ];
  },
};

export default nextConfig;
