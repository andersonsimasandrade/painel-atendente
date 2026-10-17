import { SubNav } from "@/components/SubNav";
import { InstagramInbox } from "@/components/instagram/InstagramInbox";
import { listarContatosIG } from "@/lib/ig-dados";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function InstagramPage({ searchParams }: { searchParams: { id?: string } }) {
  const contatos = await listarContatosIG();
  return (
    <div className="relative z-[1] flex h-[100dvh] flex-col overflow-hidden">
      <SubNav title="Instagram" subtitle={`${formatNumber(contatos.length)} conversas no direct e nos comentários`} />
      <main className="mx-auto flex w-full min-h-0 max-w-[1400px] flex-1 flex-col px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <InstagramInbox inicial={contatos} idInicial={searchParams?.id?.replace(/\D/g, "") || undefined} />
      </main>
    </div>
  );
}
