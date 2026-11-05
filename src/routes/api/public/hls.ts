import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

function blocked(u: URL) {
  if (!/^https?:$/.test(u.protocol)) return true;
  const h = u.hostname;
  return (
    h === "localhost" ||
    h.endsWith(".local") ||
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) ||
    h === "[::1]"
  );
}

function proxied(origin: string, abs: string) {
  return `${origin}/api/public/hls?u=${encodeURIComponent(abs)}`;
}

function rewrite(text: string, base: string, origin: string) {
  return text
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (!t) return line;
      if (t.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_, uri) => `URI="${proxied(origin, new URL(uri, base).href)}"`);
      }
      return proxied(origin, new URL(t, base).href);
    })
    .join("\n");
}

export const Route = createFileRoute("/api/public/hls")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const reqUrl = new URL(request.url);
        const raw = reqUrl.searchParams.get("u");
        if (!raw) return new Response("Falta parámetro u", { status: 400, headers: CORS });
        let target: URL;
        try {
          target = new URL(raw);
        } catch {
          return new Response("URL inválida", { status: 400, headers: CORS });
        }
        if (blocked(target)) return new Response("Origen no permitido", { status: 403, headers: CORS });

        const headers: Record<string, string> = { "User-Agent": "HLS-Relay/1.0" };
        const range = request.headers.get("range");
        if (range) headers["Range"] = range;

        const up = await fetch(target.href, { headers, redirect: "follow" });
        const ct = up.headers.get("content-type") || "";
        const isPlaylist = /mpegurl/i.test(ct) || /\.m3u8?($|\?)/i.test(target.pathname);

        if (isPlaylist && up.ok) {
          const text = await up.text();
          const proto = request.headers.get("x-forwarded-proto") || reqUrl.protocol.replace(":", "");
          const origin = `${proto}://${reqUrl.host}`;
          return new Response(rewrite(text, up.url || target.href, origin), {
            status: 200,
            headers: { ...CORS, "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "no-cache" },
          });
        }

        const out = new Headers(CORS);
        for (const k of ["content-type", "content-length", "content-range", "accept-ranges"]) {
          const v = up.headers.get(k);
          if (v) out.set(k, v);
        }
        out.set("Cache-Control", "public, max-age=30");
        return new Response(up.body, { status: up.status, headers: out });
      },
    },
  },
});
