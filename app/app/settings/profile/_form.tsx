"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateProfile } from "@/app/actions/settings/updateProfile";
import { uploadAvatar } from "@/app/actions/settings/uploadAvatar";
import { useT } from "@/hooks/i18n/useT";
import { IDIOMAS_VISIVEIS } from "@/lib/i18n/registro";
import {
  profileSchema,
  SEM_PREFERENCIA_DE_IDIOMA,
  type Locale,
} from "@/lib/schemas/settings";

const TIMEZONES = [
  "Africa/Luanda",
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Belem",
  "America/Recife",
  "America/Fortaleza",
  "UTC",
];

interface Props {
  email: string;
  initialFullName: string | null;
  initialAvatarUrl: string | null;
  initialLocale: Locale | typeof SEM_PREFERENCIA_DE_IDIOMA;
  initialTimezone: string;
}

export function ProfileForm({
  email,
  initialFullName,
  initialAvatarUrl,
  initialLocale,
  initialTimezone,
}: Props) {
  const t = useT();
  const [fullName, setFullName] = useState(initialFullName ?? "");
  const [locale, setLocale] = useState<Locale | typeof SEM_PREFERENCIA_DE_IDIOMA>(initialLocale);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("A imagem deve ter no máximo 5MB."));
      return;
    }

    try {
      setUploading(true);
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadAvatar(fd);
      if (res.ok) {
        setAvatarUrl(res.avatarUrl);
        toast.success(t("Foto de perfil atualizada!"));
      } else {
        toast.error(res.error || t("Erro ao enviar foto."));
      }
    } catch {
      toast.error(t("Erro inesperado ao enviar foto."));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = profileSchema.safeParse({
      full_name: fullName || null,
      locale,
      timezone,
      avatar_url: avatarUrl || null,
    });
    if (!parsed.success) {
      toast.error(t("Dados inválidos."));
      return;
    }
    startTransition(async () => {
      const r = await updateProfile(parsed.data);
      if (r.ok) toast.success(t("Perfil atualizado."));
      else toast.error(`${t("Erro")}: ${r.error}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl">
      <Card className="space-y-4 p-6">
        <div className="space-y-3">
          <Label>{t("Foto de perfil")}</Label>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-border bg-muted flex items-center justify-center shadow-xs">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={fullName || email}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xl font-semibold text-muted-foreground uppercase">
                  {fullName ? fullName.slice(0, 2) : email.slice(0, 2)}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  id="avatar-upload"
                  className="sr-only"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                  onChange={handleFileChange}
                  disabled={uploading || isPending}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading || isPending}
                  onClick={() => document.getElementById("avatar-upload")?.click()}
                >
                  {uploading ? t("Enviando foto...") : t("Escolher da galeria")}
                </Button>
                {avatarUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={uploading || isPending}
                    onClick={() => setAvatarUrl("")}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    {t("Remover foto")}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("Formatos aceitos: JPG, PNG, WEBP ou GIF até 5MB.")}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{t("Email")}</Label>
          <Input id="email" value={email} disabled />
          <p className="text-xs text-muted-foreground">
            {t("Trocar email — em breve.")}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="full_name">{t("Nome completo")}</Label>
          <Input
            id="full_name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={120}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="locale">{t("Idioma")}</Label>
            <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
              <SelectTrigger id="locale">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_PREFERENCIA_DE_IDIOMA}>
                  {t("Seguir o idioma da empresa")}
                </SelectItem>
                {/* A lista vem do registro, e só com o que o nível deixa
                    aparecer. Oferecer um idioma que não muda a tela é prometer
                    o que ela não cumpre — `en-US` saiu por isso, e um idioma
                    em construção fica fora pela mesma razão. */}
                {IDIOMAS_VISIVEIS.map(({ codigo, nomeNativo }) => (
                  <SelectItem key={codigo} value={codigo}>
                    {nomeNativo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">{t("Fuso horário")}</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex sm:justify-end">
          <Button type="submit" disabled={isPending || uploading} className="w-full sm:w-auto">
            {isPending ? t("Salvando…") : t("Salvar")}
          </Button>
        </div>
      </Card>
    </form>
  );
}
