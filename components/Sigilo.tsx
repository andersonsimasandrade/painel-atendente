import { ReactNode } from "react";

/**
 * Envolve um dado que identifica o LEAD (telefone, nome, iniciais, CNPJ) para
 * que o "modo demonstração" possa borrá-lo.
 *
 * Não esconde nada por conta própria: só marca. Quem borra é a regra
 * `[data-demo]` em globals.css, ligada em Ajustes e guardada no navegador de
 * quem está gravando. Fora do modo demonstração este span não muda nada.
 */
export function Sigilo({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`sigilo ${className}`}>{children}</span>;
}
