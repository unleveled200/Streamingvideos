import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HLS Relay — Retransmisión y distribución de streams" },
      { name: "description", content: "Ingesta streams HLS y redistribúyelos con URLs de salida relay listas para cualquier reproductor." },
      { property: "og:title", content: "HLS Relay — Retransmisión de streams" },
      { property: "og:description", content: "Ingesta HLS y distribuye salidas relay al instante." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type Channel = { id: string; name: string; source: string };
const KEY = "hls-relay-channels";

function relayUrl(src: string) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/api/public/hls?u=${encodeURIComponent(src)}`;
}

function Player({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    let hls: { destroy: () => void } | null = null;
    if (v.canPlayType("application/vnd.apple.mpegurl")) {
      v.src = src;
    } else {
      import("hls.js").then(({ default: Hls }) => {
        if (!Hls.isSupported()) return;
        const h = new Hls({ lowLatencyMode: true });
        h.loadSource(src);
        h.attachMedia(v);
        hls = h;
      });
    }
    return () => hls?.destroy();
  }, [src]);
  return <video ref={ref} controls muted autoPlay playsInline className="aspect-video w-full rounded-md bg-background" />;
}

function Index() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    try {
      setChannels(JSON.parse(localStorage.getItem(KEY) || "[]"));
    } catch {}
  }, []);
  const save = (c: Channel[]) => {
    setChannels(c);
    localStorage.setItem(KEY, JSON.stringify(c));
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^https?:\/\/.+/.test(source)) return;
    const c = { id: crypto.randomUUID(), name: name || `Canal ${channels.length + 1}`, source };
    save([c, ...channels]);
    setActive(c.id);
    setName("");
    setSource("");
  };

  const copy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <main className="min-h-screen px-5 py-10 md:px-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 flex items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">● On air</p>
            <h1 className="mt-2 font-display text-5xl font-bold tracking-tight md:text-6xl">HLS Relay</h1>
            <p className="mt-2 text-muted-foreground">Entrada HLS → salida HLS relay para distribuir a cualquier reproductor.</p>
          </div>
          <span className="hidden font-mono text-sm text-muted-foreground md:block">{channels.length} canales</span>
        </header>

        <form onSubmit={add} className="mb-10 grid gap-3 rounded-lg border border-border bg-card p-5 md:grid-cols-[1fr_2fr_auto]">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del canal"
            className="rounded-md border border-input bg-background px-3 py-2 outline-none focus:border-primary" />
          <input value={source} onChange={(e) => setSource(e.target.value)} required placeholder="https://origen.com/stream/index.m3u8"
            className="rounded-md border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary" />
          <button className="rounded-md bg-primary px-5 py-2 font-semibold text-primary-foreground transition hover:opacity-90">
            Añadir entrada
          </button>
        </form>

        {channels.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
            Añade una URL .m3u8 para generar tu salida relay.
            <button type="button" onClick={() => { setName("Demo Mux"); setSource("https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"); }}
              className="mt-3 block w-full font-mono text-sm text-primary underline">usar stream de prueba</button>
          </div>
        )}

        <div className="space-y-4">
          {channels.map((c) => {
            const out = relayUrl(c.source);
            return (
              <section key={c.id} className="rounded-lg border border-border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-display text-xl font-semibold">{c.name}</h2>
                  <div className="flex gap-2">
                    <button onClick={() => setActive(active === c.id ? null : c.id)}
                      className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent">
                      {active === c.id ? "Ocultar" : "Monitor"}
                    </button>
                    <button onClick={() => save(channels.filter((x) => x.id !== c.id))}
                      className="rounded-md border border-border px-3 py-1.5 text-sm text-destructive hover:bg-accent">Eliminar</button>
                  </div>
                </div>
                <dl className="mt-4 grid gap-2 font-mono text-xs">
                  <div className="flex gap-3"><dt className="w-16 shrink-0 text-muted-foreground">ENTRADA</dt><dd className="truncate">{c.source}</dd></div>
                  <div className="flex items-center gap-3">
                    <dt className="w-16 shrink-0 text-primary">SALIDA</dt>
                    <dd className="flex-1 truncate">{out}</dd>
                    <button onClick={() => copy(c.id, out)} className="rounded bg-secondary px-2 py-1 text-secondary-foreground">
                      {copied === c.id ? "¡Copiado!" : "Copiar"}
                    </button>
                  </div>
                </dl>
                {active === c.id && <div className="mt-4"><Player src={out} /></div>}
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
