import { PageSkeleton } from "@/components/PageSkeleton";

// Fallback da raiz: vale pra home e pra qualquer rota sem loading.tsx próprio,
// inclusive /login — por isso não leva nome de seção.
export default function Carregando() {
  return <PageSkeleton kpis={6} blocos={3} />;
}
