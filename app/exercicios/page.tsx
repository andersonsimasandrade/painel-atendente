import { SubNav } from "@/components/SubNav";
import { ExerciciosBoard } from "@/components/exercicios/ExerciciosBoard";
import { listarExercicios } from "@/lib/exercicios";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ExerciciosPage() {
  const exercicios = await listarExercicios(true);
  const ativos = exercicios.filter((e) => e.ativo).length;
  return (
    <div className="relative z-[1] min-h-screen">
      <SubNav title="Exercícios" subtitle={`${ativos} na biblioteca · usados nos planos de exercícios para casa`} />
      <main className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 lg:px-8">
        <ExerciciosBoard exercicios={exercicios} />
      </main>
    </div>
  );
}
