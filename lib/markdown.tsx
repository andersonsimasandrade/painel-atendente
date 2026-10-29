import { Fragment, type ReactNode } from "react";

// Renderizador de Markdown SEGURO e sem dependências: devolve elementos React (nada de HTML cru), então um texto
// malicioso não consegue injetar script. Suporta: títulos, parágrafos, listas, citações, linhas, tabelas simples,
// negrito, itálico, código, links e imagens (só http/https ou caminhos do próprio site).
// "#" e "##" viram h2 (o h1 do artigo é o título); "###" vira h3; mais fundo vira h4.

const seguro = (u: string): string | null => {
  const s = u.trim();
  if (/^https?:\/\//i.test(s) || s.startsWith("/") || s.startsWith("#") || /^(mailto|tel):/i.test(s)) return s;
  return null;
};

type Inline = ReactNode;

/** Converte o texto de uma linha em negrito, itálico, código, links e imagens. */
function inline(texto: string, chave: string): Inline[] {
  const out: Inline[] = [];
  const re = /(!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\))|(\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\))|(\*\*([^*]+)\*\*)|(__([^_]+)__)|(\*([^*\s][^*]*)\*)|(`([^`]+)`)|(https?:\/\/[^\s<)]+)/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(texto))) {
    if (m.index > ultimo) out.push(texto.slice(ultimo, m.index));
    const k = `${chave}-${i++}`;
    if (m[1]) {
      const src = seguro(m[3]);
      // eslint-disable-next-line @next/next/no-img-element
      out.push(src ? <img key={k} src={src} alt={m[2]} loading="lazy" className="my-4 h-auto max-w-full rounded-xl" /> : m[2]);
    } else if (m[4]) {
      const href = seguro(m[6]);
      const externo = href ? /^https?:\/\//i.test(href) : false;
      out.push(
        href ? (
          <a key={k} href={href} {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="font-semibold text-[#0F7F70] underline underline-offset-2 hover:text-[#0B6B5E]">
            {inline(m[5], k)}
          </a>
        ) : (
          m[5]
        ),
      );
    } else if (m[7] || m[9]) {
      out.push(<strong key={k}>{inline(m[8] ?? m[10], k)}</strong>);
    } else if (m[11]) {
      out.push(<em key={k}>{inline(m[12], k)}</em>);
    } else if (m[13]) {
      out.push(
        <code key={k} className="rounded bg-[#E4EEEC] px-1.5 py-0.5 text-[0.92em]">
          {m[14]}
        </code>,
      );
    } else if (m[15]) {
      out.push(
        <a key={k} href={m[15]} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#0F7F70] underline underline-offset-2">
          {m[15]}
        </a>,
      );
    }
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) out.push(texto.slice(ultimo));
  return out;
}

const ehTabelaSep = (l: string) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(l);
const celulas = (l: string) =>
  l
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

export function renderMarkdown(md: string): ReactNode {
  const linhas = md.replace(/\r\n?/g, "\n").split("\n");
  const blocos: ReactNode[] = [];
  let i = 0;
  let n = 0;
  const chave = () => `b${n++}`;

  while (i < linhas.length) {
    const l = linhas[i];
    if (!l.trim()) {
      i++;
      continue;
    }

    // código em bloco
    if (/^```/.test(l)) {
      const buf: string[] = [];
      i++;
      while (i < linhas.length && !/^```/.test(linhas[i])) buf.push(linhas[i++]);
      i++;
      blocos.push(
        <pre key={chave()} className="my-4 overflow-x-auto rounded-xl bg-[#E4EEEC] p-4 text-[13.5px]">
          <code>{buf.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // título
    const h = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(l);
    if (h) {
      const nivel = h[1].length;
      const k = chave();
      const conteudo = inline(h[2], k);
      if (nivel <= 2)
        blocos.push(
          <h2 key={k} className="mt-9 font-destaque text-[22px] font-bold leading-snug text-[#354746] sm:text-[26px]">
            {conteudo}
          </h2>,
        );
      else if (nivel === 3)
        blocos.push(
          <h3 key={k} className="mt-7 font-destaque text-[18px] font-bold leading-snug text-[#354746] sm:text-[20px]">
            {conteudo}
          </h3>,
        );
      else
        blocos.push(
          <h4 key={k} className="mt-6 text-[16px] font-bold text-[#354746]">
            {conteudo}
          </h4>,
        );
      i++;
      continue;
    }

    // linha horizontal
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) {
      blocos.push(<hr key={chave()} className="my-8 border-[#DCE8E5]" />);
      i++;
      continue;
    }

    // citação
    if (/^\s*>/.test(l)) {
      const buf: string[] = [];
      while (i < linhas.length && /^\s*>/.test(linhas[i])) buf.push(linhas[i++].replace(/^\s*>\s?/, ""));
      // O conteúdo da citação é markdown também (o "Resumo em 30 segundos" é uma lista dentro da citação).
      blocos.push(
        <blockquote key={chave()} className="my-5 border-l-4 border-[#1EB49F] bg-[#EAF8F6] px-4 py-1 text-[#3F5452] [&_p]:my-2 [&_ul]:my-2">
          {renderMarkdown(buf.join("\n"))}
        </blockquote>,
      );
      continue;
    }

    // tabela
    if (l.includes("|") && i + 1 < linhas.length && ehTabelaSep(linhas[i + 1])) {
      const cab = celulas(l);
      i += 2;
      const corpo: string[][] = [];
      while (i < linhas.length && linhas[i].includes("|") && linhas[i].trim()) corpo.push(celulas(linhas[i++]));
      const k = chave();
      blocos.push(
        <div key={k} className="my-5 overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-left text-[14.5px]">
            <thead>
              <tr>
                {cab.map((c, j) => (
                  <th key={j} className="border-b-2 border-[#BFD3CF] px-3 py-2 font-bold text-[#354746]">
                    {inline(c, `${k}h${j}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {corpo.map((linha, a) => (
                <tr key={a} className="border-b border-[#DCE8E5]">
                  {linha.map((c, j) => (
                    <td key={j} className="px-3 py-2 align-top">
                      {inline(c, `${k}r${a}c${j}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // lista (ordenada ou não)
    const ul = /^\s*[-*+]\s+/.test(l);
    const ol = /^\s*\d+[.)]\s+/.test(l);
    if (ul || ol) {
      const itens: string[] = [];
      const re = ul ? /^\s*[-*+]\s+/ : /^\s*\d+[.)]\s+/;
      while (i < linhas.length && re.test(linhas[i])) {
        let t = linhas[i++].replace(re, "");
        while (i < linhas.length && linhas[i].trim() && /^\s{2,}\S/.test(linhas[i]) && !re.test(linhas[i])) t += " " + linhas[i++].trim();
        itens.push(t);
      }
      const k = chave();
      const filhos = itens.map((t, j) => <li key={j}>{inline(t, `${k}-${j}`)}</li>);
      blocos.push(
        ul ? (
          <ul key={k} className="my-4 list-disc space-y-1.5 pl-6 marker:text-[#1EB49F]">
            {filhos}
          </ul>
        ) : (
          <ol key={k} className="my-4 list-decimal space-y-1.5 pl-6 marker:font-semibold marker:text-[#0F7F70]">
            {filhos}
          </ol>
        ),
      );
      continue;
    }

    // parágrafo
    const buf: string[] = [];
    while (
      i < linhas.length &&
      linhas[i].trim() &&
      !/^(#{1,6}\s|```|\s*>|\s*[-*+]\s+|\s*\d+[.)]\s+)/.test(linhas[i]) &&
      !/^\s*([-*_])(\s*\1){2,}\s*$/.test(linhas[i])
    ) {
      buf.push(linhas[i++].trim());
    }
    if (!buf.length) {
      i++;
      continue;
    }
    const k = chave();
    blocos.push(
      <p key={k} className="my-4 leading-[1.75]">
        {inline(buf.join(" "), k)}
      </p>,
    );
  }
  return <Fragment>{blocos}</Fragment>;
}
