/**
 * Contrato da Galeria de imagens (biblioteca do time).
 *
 * Só entra o que o TIME subiu: chat outbound, fluxos de disparo, fluxos de
 * IA e upload direto. Inbound do cliente e avatar nunca entram — a origem é
 * decidida por quem escreve (rotas de upload + sincronização da lista),
 * nunca por varredura cega do bucket.
 */
import { z } from "zod";

export const GALERIA_ORIGENS = ["chat", "disparo", "fluxo", "galeria"] as const;
export type GaleriaOrigem = (typeof GALERIA_ORIGENS)[number];

export const galeriaArquivoSchema = z.strictObject({
  id: z.string().uuid(),
  storage_path: z.string().min(1).max(500),
  nome: z.string().min(1).max(120),
  mime: z.string(),
  size_bytes: z.number().int().nonnegative(),
  largura: z.number().int().positive().nullable(),
  altura: z.number().int().positive().nullable(),
  origem: z.enum(GALERIA_ORIGENS),
  pasta_id: z.string().uuid().nullable(),
  created_at: z.string(),
  /** URL assinada curta para pré-visualizar. Nunca gravada. */
  preview_url: z.string().optional(),
});
export type GaleriaArquivo = z.infer<typeof galeriaArquivoSchema>;

export const galeriaPastaSchema = z.strictObject({
  id: z.string().uuid(),
  nome: z.string().min(1).max(60),
  created_at: z.string(),
  total_arquivos: z.number().int().nonnegative().optional(),
});
export type GaleriaPasta = z.infer<typeof galeriaPastaSchema>;

export const galeriaListQuerySchema = z.strictObject({
  q: z.string().trim().max(120).optional(),
  /** uuid da pasta, "sem_pasta" ou ausente = tudo. */
  pasta: z.string().optional(),
  origem: z.enum(GALERIA_ORIGENS).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(60),
  offset: z.coerce.number().int().min(0).default(0),
});
export type GaleriaListQuery = z.infer<typeof galeriaListQuerySchema>;

export const galeriaPatchSchema = z
  .strictObject({
    nome: z.string().trim().min(1).max(120).optional(),
    /** uuid, null (tirar da pasta) ou ausente (não mexer). */
    pasta_id: z.string().uuid().nullable().optional(),
  })
  .refine((d) => d.nome !== undefined || d.pasta_id !== undefined, {
    message: "Nada para atualizar.",
  });

export const galeriaPastaCreateSchema = z.strictObject({
  nome: z.string().trim().min(1).max(60),
});

export const NOME_SEM_PASTA = "sem_pasta";
