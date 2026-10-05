import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel + Supabase Cloud: sem `output: standalone` (era o modo Docker do
  // self-host) e sem `outputFileTracingIncludes` (binarios do container).
  // O default da Vercel empacota sozinho.
  reactStrictMode: true,
  poweredByHeader: false,
  // typedRoutes moved out of experimental in Next 15.5+
  typedRoutes: true,
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react", "lucide-react", "date-fns"],
  },
  images: {
    // O app nÃ£o usa next/image de fato (sÃ³ <img> raw); desligar o otimizador
    // evita exigir o binÃ¡rio `sharp` no runtime do container.
    unoptimized: true,
    remotePatterns: [
      // Supabase Storage (assinado)
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
    ],
  },
  async headers() {
    return [
      {
        source: "/notify-sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // microphone=(self): o gravador de voz do composer (PTT estilo WhatsApp)
          // usa getUserMedia({audio}); microphone=() bloquearia em TODA origem,
          // inclusive a prÃ³pria â€” daria "microphone is not allowed in this document".
          // CÃ¢mera e geolocalizaÃ§Ã£o seguem bloqueadas (nÃ£o usadas).
          // notifications=(self): bandeja do SO quando a janela estÃ¡ minimizada.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=(), notifications=(self)",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "automatik-labs",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // HeranÃ§a do wizard do Sentry (instrumentaÃ§Ã£o automÃ¡tica de cron monitors).
    // Inerte aqui: o bloco `webpack:` inteiro Ã© ignorado pelo build de produÃ§Ã£o,
    // que roda Turbopack (ver Dockerfile). Fica como resÃ­duo defensivo, nÃ£o como
    // modo de build suportado por este repositÃ³rio.
    // https://docs.sentry.io/product/crons/
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
