"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useT } from "@/hooks/i18n/useT";
import { prepararImagemParaUpload } from "@/lib/midia/comprimir-imagem";

export interface DispatchImageState {
  imageUrl: string;
  storagePath: string;
  previewUrl: string;
  fileName: string;
}

/**
 * Upload de imagem de fluxo de disparo via
 * POST /api/v1/ai/followup-flows/upload-media.
 *
 * Estado compartilhado do DispatchFlowEditor (criação e edição no mesmo
 * layout em estilo nodes): mesma rota, mesmo estado, um source of truth.
 */
export function useDispatchImageUpload(initial?: Partial<DispatchImageState>) {
  const t = useT();
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [storagePath, setStoragePath] = useState(initial?.storagePath ?? "");
  const [previewUrl, setPreviewUrl] = useState(initial?.previewUrl ?? "");
  const [fileName, setFileName] = useState(initial?.fileName ?? "");
  const [isUploading, setIsUploading] = useState(false);

  const uploadFile = async (
    file: File,
  ): Promise<{ storage_path: string; url: string; name: string } | null> => {
    if (!file.type.startsWith("image/")) {
      toast.error(t("Selecione um arquivo de imagem válido (PNG, JPG, WEBP)."));
      return null;
    }
    setIsUploading(true);
    try {
      // Compacta antes de subir (mesma qualidade aparente, menos MB).
      const pronta = await prepararImagemParaUpload(file);
      const formData = new FormData();
      formData.append("file", pronta.blob, pronta.filename);
      const res = await fetch("/api/v1/ai/followup-flows/upload-media", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.data) {
        throw new Error(json.error?.message || t("Erro ao fazer upload da imagem."));
      }
      const { storage_path, url, name: uploadedName } = json.data;
      setStoragePath(storage_path);
      setPreviewUrl(url);
      setImageUrl(url || storage_path);
      setFileName(uploadedName || file.name);
      toast.success(t("Imagem carregada com sucesso!"));
      return { storage_path, url, name: uploadedName || file.name };
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("Falha no envio da imagem.");
      toast.error(msg);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = () => {
    setImageUrl("");
    setStoragePath("");
    setPreviewUrl("");
    setFileName("");
  };

  /** Preenche o estado ao abrir um fluxo existente (storage path incluído). */
  const hydrate = (state: Partial<DispatchImageState>) => {
    if (state.imageUrl !== undefined) setImageUrl(state.imageUrl);
    if (state.storagePath !== undefined) setStoragePath(state.storagePath);
    if (state.previewUrl !== undefined) setPreviewUrl(state.previewUrl);
    if (state.fileName !== undefined) setFileName(state.fileName);
  };

  const hasImage = Boolean(previewUrl || imageUrl || storagePath);

  /** Enviável pelo WhatsApp: storage path ou https. http:/data: não trafegam. */
  const sendableImage = (() => {
    const isHttps = (v: string) => v.trim().startsWith("https://");
    return (
      storagePath.trim() ||
      (isHttps(imageUrl) ? imageUrl.trim() : "") ||
      (isHttps(previewUrl) ? previewUrl.trim() : "")
    );
  })();

  return {
    imageUrl,
    setImageUrl,
    storagePath,
    previewUrl,
    setPreviewUrl,
    fileName,
    isUploading,
    hasImage,
    sendableImage,
    uploadFile,
    removeImage,
    hydrate,
  };
}
