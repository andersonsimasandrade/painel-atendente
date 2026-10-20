"use client";

import { useMemo, useState } from "react";

// Gerador de links com o PADRÃO DE NOMES do projeto (o mesmo que o gerador de criativos deve usar):
//   utm_source   = quem trouxe a pessoa (google, facebook, instagram...)
//   utm_medium   = como (cpc = anúncio pago, social = post, bio = link da bio, story = stories)
//   utm_campaign = campanha em letras minúsculas e hífen (busca-fisio-floripa)
//   utm_content  = ID do criativo (o MESMO ID da linha do criativos.csv / nome do anúncio)
//   utm_term     = palavra-chave (Google) ou público (Meta)

const BASE = "https://andersonandradefisio.com.br";

const ORIGENS = [
  { id: "meta-anuncio", rot: "Meta Ads (anúncio)", source: "facebook", medium: "cpc" },
  { id: "google-anuncio", rot: "Google Ads (anúncio)", source: "google", medium: "cpc" },
  { id: "ig-bio", rot: "Instagram: link da bio", source: "instagram", medium: "bio" },
  { id: "ig-story", rot: "Instagram: stories", source: "instagram", medium: "story" },
  { id: "ig-post", rot: "Instagram: legenda/comentário", source: "instagram", medium: "social" },
  { id: "wa-status", rot: "WhatsApp: status/lista", source: "whatsapp", medium: "social" },
  { id: "outro", rot: "Outro", source: "outro", medium: "referral" },
] as const;

const DESTINOS = [
  { id: "/", rot: "Página inicial" },
  { id: "/agendar", rot: "Agendar (formulário)" },
  { id: "/capoeiras", rot: "Consultório Capoeiras" },
  { id: "/centro", rot: "Consultório Centro" },
];

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

export function GeradorLinks() {
  const [origem, setOrigem] = useState<string>("meta-anuncio");
  const [destino, setDestino] = useState("/agendar");
  const [campanha, setCampanha] = useState("site-fisio-floripa");
  const [criativo, setCriativo] = useState("");
  const [termo, setTermo] = useState("");
  const [auto, setAuto] = useState(true);
  const [copiado, setCopiado] = useState(false);

  const o = ORIGENS.find((x) => x.id === origem) ?? ORIGENS[0];

  const url = useMemo(() => {
    const p: string[] = [`utm_source=${o.source}`, `utm_medium=${o.medium}`];
    if (auto && origem === "meta-anuncio") {
      // Macros da Meta: o painel recebe o nome real da campanha, do anúncio e do conjunto.
      p.push("utm_campaign={{campaign.name}}", "utm_content={{ad.name}}", "utm_term={{adset.name}}");
    } else if (auto && origem === "google-anuncio") {
      p.push(`utm_campaign=${slug(campanha) || "campanha"}`, "utm_content={creative}", "utm_term={keyword}");
    } else {
      p.push(`utm_campaign=${slug(campanha) || "campanha"}`);
      if (criativo.trim()) p.push(`utm_content=${encodeURIComponent(criativo.trim().slice(0, 80))}`);
      if (termo.trim()) p.push(`utm_term=${encodeURIComponent(slug(termo))}`);
    }
    return `${BASE}${destino === "/" ? "/" : destino}?${p.join("&")}`;
  }, [o, origem, destino, campanha, criativo, termo, auto]);

  const automatico = origem === "meta-anuncio" || origem === "google-anuncio";

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      /* o usuário copia manualmente */
    }
  }

  const campo = "w-full rounded-lg border border-line bg-transparent px-3 py-2 text-[13px] text-ink outline-none focus:border-brand";
  return (
    <div className="space-y-3 text-[13px]">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-ink-muted">Onde o link vai aparecer</span>
          <select className={campo} value={origem} onChange={(e) => setOrigem(e.target.value)}>
            {ORIGENS.map((x) => (
              <option key={x.id} value={x.id} className="text-black">
                {x.rot}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-ink-muted">Página de destino</span>
          <select className={campo} value={destino} onChange={(e) => setDestino(e.target.value)}>
            {DESTINOS.map((x) => (
              <option key={x.id} value={x.id} className="text-black">
                {x.rot}
              </option>
            ))}
          </select>
        </label>
      </div>

      {automatico && (
        <label className="flex items-start gap-2 text-ink-muted">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="mt-0.5" />
          <span>
            Preencher sozinho pela plataforma (recomendado):{" "}
            {origem === "meta-anuncio"
              ? "a Meta troca os códigos pelo nome real da campanha, do conjunto e do anúncio. Dê ao anúncio o MESMO nome/ID do criativo."
              : "o Google troca {creative} e {keyword} pelo anúncio e pela palavra-chave que gerou o clique."}
          </span>
        </label>
      )}

      {!(automatico && auto) && (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-ink-muted">Campanha</span>
            <input className={campo} value={campanha} onChange={(e) => setCampanha(e.target.value)} placeholder="busca-fisio-floripa" />
          </label>
          <label className="block">
            <span className="mb-1 block text-ink-muted">ID do criativo</span>
            <input className={campo} value={criativo} onChange={(e) => setCriativo(e.target.value)} placeholder="A03-F45-v2" />
          </label>
          <label className="block">
            <span className="mb-1 block text-ink-muted">Público ou palavra-chave</span>
            <input className={campo} value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="florianopolis-25-55" />
          </label>
        </div>
      )}

      <div className="rounded-xl border border-line bg-white/[0.03] p-3">
        <p className="break-all font-mono text-[12px] text-ink">{url}</p>
        <button
          type="button"
          onClick={copiar}
          className="mt-2 rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-black hover:opacity-90"
        >
          {copiado ? "Copiado!" : "Copiar link"}
        </button>
      </div>
      <p className="text-[12px] text-ink-muted">
        Padrão do ID do criativo: <b>A</b>ngulo + <b>F</b>ormato + <b>v</b>ersão (ex.: A03-F45-v2 = ângulo 3, formato 4:5, versão 2). Não escreva
        queixa de saúde nem nome de paciente no ID.
      </p>
    </div>
  );
}
