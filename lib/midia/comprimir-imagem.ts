/**
 * Compressão de imagem no browser, antes do upload.
 *
 * "Mesma qualidade (ou parecida), menos MB": preserva a PROPORÇÃO original
 * (retrato continua retrato, paisagem continua paisagem — o que muda é só o
 * corte do CSS, ver abaixo) e, só quando o arquivo é grande, limita o lado
 * maior a 2048px e re-encoda em JPEG q0.88. Foto de iPhone típica (3–8 MB,
 * 4000px+) cai para 300–700 KB sem diferença visível no WhatsApp — que, de
 * todo modo, re-comprime ao exibir. Sem dependência nova (sem sharp no
 * bundle): canvas + createImageBitmap, que todo browser moderno tem.
 *
 * Fora de escopo de propósito: GIF (animação morreria no re-encode),
 * arquivos já leves (≤1,2 MB e ≤2048px voltam intactos) e não-imagens.
 */

export interface ImagemPronta {
  blob: Blob;
  filename: string;
  mime: string;
  largura: number;
  altura: number;
}

const LADO_MAXIMO = 2048;
const BYTES_SEM_COMPRESSAO = 1200 * 1024;
const QUALIDADE_JPEG = 0.88;

export async function prepararImagemParaUpload(
  file: File | Blob,
  filename?: string,
): Promise<ImagemPronta> {
  const nome = filename ?? (file instanceof File ? file.name : "imagem.jpg");
  const tipo = file.type || "image/jpeg";
  const passthrough = (blob: Blob | File): ImagemPronta => ({
    blob,
    filename: nome,
    mime: tipo,
    largura: 0,
    altura: 0,
  });
  if (!tipo.startsWith("image/") || tipo === "image/gif") return passthrough(file);
  if (file.size <= BYTES_SEM_COMPRESSAO) {
    try {
      const bmp = await createImageBitmap(file);
      const precisa = Math.max(bmp.width, bmp.height) > LADO_MAXIMO;
      bmp.close();
      if (!precisa) return passthrough(file);
    } catch {
      return passthrough(file);
    }
  }

  try {
    const bmp = await createImageBitmap(file);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(bmp.width, bmp.height));
    const largura = Math.max(1, Math.round(bmp.width * escala));
    const altura = Math.max(1, Math.round(bmp.height * escala));
    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bmp.close();
      return passthrough(file);
    }
    ctx.drawImage(bmp, 0, 0, largura, altura);
    bmp.close();
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALIDADE_JPEG),
    );
    if (!blob) return passthrough(file);
    const base = nome.replace(/\.[a-z0-9]+$/i, "") || "imagem";
    return { blob, filename: `${base}.jpg`, mime: "image/jpeg", largura, altura };
  } catch {
    return passthrough(file);
  }
}
