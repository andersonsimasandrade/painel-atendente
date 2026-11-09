import QRCode from "qrcode";

/** QR code em SVG (gerado no servidor, sem imagem externa): bom para tela e para impressão. */
export async function QrSvg({ url, tamanho = 104, rotulo }: { url: string; tamanho?: number; rotulo: string }) {
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, width: tamanho, color: { dark: "#354746", light: "#FFFFFF" }, errorCorrectionLevel: "M" });
  return (
    <div className="flex flex-col items-center text-center" style={{ width: tamanho + 16 }}>
      <div role="img" aria-label={rotulo} className="rounded-lg border border-[#D8E4E1] bg-white p-1" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="mt-1.5 text-[11.5px] font-semibold leading-tight text-[#354746]">{rotulo}</p>
    </div>
  );
}
