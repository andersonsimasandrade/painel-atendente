"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Indicador "ao vivo": mostra o tempo desde a última atualização e
 * dispara router.refresh() periodicamente para manter os números frescos
 * (a página é force-dynamic, então cada refresh reconsulta o banco).
 */
export function LiveStatus({ generatedAt }: { generatedAt: string }) {
  const router = useRouter();
  const [now, setNow] = useState<number>(() => Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const base = new Date(generatedAt).getTime();

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const REFRESH_MS = 60_000;
    const id = setInterval(() => {
      setRefreshing(true);
      router.refresh();
      // some o "atualizando" após um instante
      setTimeout(() => setRefreshing(false), 1200);
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [router]);

  const secs = Math.max(0, Math.round((now - base) / 1000));
  const label =
    refreshing
      ? "atualizando…"
      : secs < 5
        ? "atualizado agora"
        : secs < 60
          ? `atualizado há ${secs}s`
          : `atualizado há ${Math.round(secs / 60)} min`;

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-2/60 px-3 py-1.5">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-brand animate-pulse-ring" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
      </span>
      <span className="font-mono text-[11px] tracking-tight text-ink-muted">{label}</span>
    </div>
  );
}
