"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { waitConfigSchema } from "@/lib/followup/graph-schema";
import { MODOS_DE_ESPERA, opcoes } from "@/lib/followup/vocabulario";
import { useT } from "@/hooks/i18n/useT";

import type { ConfigOf } from "./shared";

type TimeUnit = "seconds" | "minutes" | "hours" | "days";

function msToUnitAndValue(ms: number): { value: number; unit: TimeUnit } {
  if (ms >= 86_400_000 && ms % 86_400_000 === 0) {
    return { value: Math.round(ms / 86_400_000), unit: "days" };
  }
  if (ms >= 3_600_000 && ms % 3_600_000 === 0) {
    return { value: Math.round(ms / 3_600_000), unit: "hours" };
  }
  if (ms >= 60_000 && ms % 60_000 === 0) {
    return { value: Math.round(ms / 60_000), unit: "minutes" };
  }
  return { value: Math.max(1, Math.round(ms / 1_000)), unit: "seconds" };
}

function unitAndValueToMs(value: number, unit: TimeUnit): number {
  const v = Math.max(1, Number.isFinite(value) ? value : 1);
  switch (unit) {
    case "seconds":
      return Math.round(v * 1_000);
    case "minutes":
      return Math.round(v * 60_000);
    case "hours":
      return Math.round(v * 3_600_000);
    case "days":
      return Math.round(v * 86_400_000);
  }
}

export function WaitForm({
  config,
  onChange,
}: {
  config: ConfigOf<"wait">;
  onChange: (c: ConfigOf<"wait">) => void;
}) {
  const t = useT();
  const [mode, setMode] = useState<"fixed" | "smart">(config.mode);

  const initialFixed = msToUnitAndValue(config.mode === "fixed" ? config.duration_ms : 60_000);
  const [durationValue, setDurationValue] = useState(initialFixed.value);
  const [durationUnit, setDurationUnit] = useState<TimeUnit>(initialFixed.unit);
  const [immuneToReply, setImmuneToReply] = useState(
    config.mode === "fixed" ? config.immune_to_reply === true : false,
  );

  const initialMin = msToUnitAndValue(config.mode === "smart" ? config.min_ms : 300_000);
  const [minValue, setMinValue] = useState(initialMin.value);
  const [minUnit, setMinUnit] = useState<TimeUnit>(initialMin.unit);

  const initialMax = msToUnitAndValue(config.mode === "smart" ? config.max_ms : 3_600_000);
  const [maxValue, setMaxValue] = useState(initialMax.value);
  const [maxUnit, setMaxUnit] = useState<TimeUnit>(initialMax.unit);

  const [guidance, setGuidance] = useState(config.mode === "smart" ? (config.guidance ?? "") : "");
  const [error, setError] = useState<string | null>(null);

  const commit = (next: {
    mode: "fixed" | "smart";
    durationValue: number;
    durationUnit: TimeUnit;
    immuneToReply: boolean;
    minValue: number;
    minUnit: TimeUnit;
    maxValue: number;
    maxUnit: TimeUnit;
    guidance: string;
  }) => {
    const candidate =
      next.mode === "fixed"
        ? {
            mode: "fixed" as const,
            duration_ms: unitAndValueToMs(next.durationValue, next.durationUnit),
            ...(next.immuneToReply ? { immune_to_reply: true } : {}),
          }
        : {
            mode: "smart" as const,
            min_ms: unitAndValueToMs(next.minValue, next.minUnit),
            max_ms: unitAndValueToMs(next.maxValue, next.maxUnit),
            ...(next.guidance.trim() ? { guidance: next.guidance } : {}),
          };
    const parsed = waitConfigSchema.safeParse(candidate);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t("Configuração inválida."));
      return;
    }
    setError(null);
    onChange(parsed.data);
  };

  const handleModeChange = (next: "fixed" | "smart") => {
    setMode(next);
    commit({
      mode: next,
      durationValue,
      durationUnit,
      immuneToReply,
      minValue,
      minUnit,
      maxValue,
      maxUnit,
      guidance,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="wait-mode">{t("Como calcular a espera")}</Label>
        <Select value={mode} onValueChange={(v) => handleModeChange(v as "fixed" | "smart")}>
          <SelectTrigger id="wait-mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {opcoes(MODOS_DE_ESPERA).map(({ valor, rotulo }) => (
              <SelectItem key={valor} value={valor}>
                {t(rotulo)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {mode === "fixed" ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="wait-duration">{t("Tempo de Espera (Delay)")}</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                id="wait-duration"
                type="number"
                min={1}
                value={durationValue}
                onChange={(e) => {
                  const v = Math.max(1, Number(e.target.value) || 1);
                  setDurationValue(v);
                  commit({
                    mode,
                    durationValue: v,
                    durationUnit,
                    immuneToReply,
                    minValue,
                    minUnit,
                    maxValue,
                    maxUnit,
                    guidance,
                  });
                }}
              />
              <Select
                value={durationUnit}
                onValueChange={(u) => {
                  const unit = u as TimeUnit;
                  setDurationUnit(unit);
                  commit({
                    mode,
                    durationValue,
                    durationUnit: unit,
                    immuneToReply,
                    minValue,
                    minUnit,
                    maxValue,
                    maxUnit,
                    guidance,
                  });
                }}
              >
                <SelectTrigger id="wait-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="seconds">{t("Segundos (digitação rápida)")}</SelectItem>
                  <SelectItem value="minutes">{t("Minutos")}</SelectItem>
                  <SelectItem value="hours">{t("Horas")}</SelectItem>
                  <SelectItem value="days">{t("Dias")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("Use segundos (ex: 5s, 10s) para simular digitação humanizada ou delay antes da próxima mensagem. Use minutos/horas/dias para cadências de retorno.")}
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="wait-immune"
              checked={immuneToReply}
              onChange={(e) => {
                const checked = e.target.checked;
                setImmuneToReply(checked);
                commit({
                  mode,
                  durationValue,
                  durationUnit,
                  immuneToReply: checked,
                  minValue,
                  minUnit,
                  maxValue,
                  maxUnit,
                  guidance,
                });
              }}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="wait-immune" className="text-xs font-normal cursor-pointer">
              {t("Não cancelar/encurtar se o lead responder durante esta espera")}
            </Label>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("Espera Mínima")}</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  min={1}
                  value={minValue}
                  onChange={(e) => {
                    const v = Math.max(1, Number(e.target.value) || 1);
                    setMinValue(v);
                    commit({
                      mode,
                      durationValue,
                      durationUnit,
                      immuneToReply,
                      minValue: v,
                      minUnit,
                      maxValue,
                      maxUnit,
                      guidance,
                    });
                  }}
                />
                <Select
                  value={minUnit}
                  onValueChange={(u) => {
                    const unit = u as TimeUnit;
                    setMinUnit(unit);
                    commit({
                      mode,
                      durationValue,
                      durationUnit,
                      immuneToReply,
                      minValue,
                      minUnit: unit,
                      maxValue,
                      maxUnit,
                      guidance,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seconds">{t("Segundos")}</SelectItem>
                    <SelectItem value="minutes">{t("Minutos")}</SelectItem>
                    <SelectItem value="hours">{t("Horas")}</SelectItem>
                    <SelectItem value="days">{t("Dias")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t("Espera Máxima")}</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  min={1}
                  value={maxValue}
                  onChange={(e) => {
                    const v = Math.max(1, Number(e.target.value) || 1);
                    setMaxValue(v);
                    commit({
                      mode,
                      durationValue,
                      durationUnit,
                      immuneToReply,
                      minValue,
                      minUnit,
                      maxValue: v,
                      maxUnit,
                      guidance,
                    });
                  }}
                />
                <Select
                  value={maxUnit}
                  onValueChange={(u) => {
                    const unit = u as TimeUnit;
                    setMaxUnit(unit);
                    commit({
                      mode,
                      durationValue,
                      durationUnit,
                      immuneToReply,
                      minValue,
                      minUnit,
                      maxValue,
                      maxUnit: unit,
                      guidance,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seconds">{t("Segundos")}</SelectItem>
                    <SelectItem value="minutes">{t("Minutos")}</SelectItem>
                    <SelectItem value="hours">{t("Horas")}</SelectItem>
                    <SelectItem value="days">{t("Dias")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wait-guidance">{t("Orientação para IA (opcional)")}</Label>
            <Textarea
              id="wait-guidance"
              maxLength={500}
              placeholder={t("Ex: Espere o contato responder sobre o horário ou até o final do dia.")}
              value={guidance}
              onChange={(e) => {
                setGuidance(e.target.value);
                commit({
                  mode,
                  durationValue,
                  durationUnit,
                  immuneToReply,
                  minValue,
                  minUnit,
                  maxValue,
                  maxUnit,
                  guidance: e.target.value,
                });
              }}
            />
          </div>
        </>
      )}
      {error && <p className="text-xs text-error-fg">{error}</p>}
    </div>
  );
}
