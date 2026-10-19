import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ZoomDoFio } from "@/components/inbox/ZoomDoFio";
import {
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_PADRAO,
  assinarZoom,
  gravarZoom,
  lerZoom,
  normalizarZoom,
} from "@/lib/inbox/zoom-do-fio";

/**
 * O zoom do fio é preferência de leitura POR PESSOA, guardada no `localStorage`
 * — e o `localStorage` é entrada externa (qualquer coisa pode estar lá: string
 * vazia, `NaN`, valor fora da faixa). Estes testes prendem as duas metades: a
 * sanitização do valor cru e a pílula que o dono pediu para ver no topo do fio.
 */

const USUARIO = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("normalizarZoom", () => {
  it("prende na faixa 80–140 e alinha ao passo de 10", () => {
    expect(normalizarZoom(90)).toBe(90);
    expect(normalizarZoom(93)).toBe(90);
    expect(normalizarZoom(97)).toBe(100);
    expect(normalizarZoom(200)).toBe(ZOOM_MAX);
    expect(normalizarZoom(10)).toBe(ZOOM_MIN);
    expect(normalizarZoom(-40)).toBe(ZOOM_MIN);
  });

  it("cai no padrão com valor não numérico", () => {
    expect(normalizarZoom(Number.NaN)).toBe(ZOOM_PADRAO);
    expect(normalizarZoom(Number.POSITIVE_INFINITY)).toBe(ZOOM_PADRAO);
  });
});

describe("lerZoom / gravarZoom", () => {
  it("sem nada guardado, devolve o padrão", () => {
    expect(lerZoom(USUARIO)).toBe(ZOOM_PADRAO);
  });

  it("grava, relê e não vaza entre pessoas diferentes", () => {
    gravarZoom(USUARIO, 120);
    expect(lerZoom(USUARIO)).toBe(120);
    expect(lerZoom("outra-pessoa")).toBe(ZOOM_PADRAO);
  });

  it("higieniza o valor cru do localStorage", () => {
    window.localStorage.setItem(`inbox.zoom-do-fio.v1:${USUARIO}`, "999");
    expect(lerZoom(USUARIO)).toBe(ZOOM_MAX);
    window.localStorage.setItem(`inbox.zoom-do-fio.v1:${USUARIO}`, "lixo");
    expect(lerZoom(USUARIO)).toBe(ZOOM_PADRAO);
  });

  it("avisa os ouvintes quando grava, e para ao desassinar", () => {
    const espia = vi.fn();
    const desassinar = assinarZoom(espia);
    gravarZoom(USUARIO, 130);
    expect(espia).toHaveBeenCalledTimes(1);
    desassinar();
    gravarZoom(USUARIO, 140);
    expect(espia).toHaveBeenCalledTimes(1);
  });
});

describe("ZoomDoFio", () => {
  it("mostra o padrão e sobe um passo por clique", () => {
    render(<ZoomDoFio userId={USUARIO} />);
    expect(screen.getByTestId("zoom-do-fio-valor")).toHaveTextContent(`${ZOOM_PADRAO}%`);

    fireEvent.click(screen.getByTestId("zoom-do-fio-aumentar"));
    expect(screen.getByTestId("zoom-do-fio-valor")).toHaveTextContent("100%");
    expect(lerZoom(USUARIO)).toBe(100);
  });

  it("desabilita nas duas pontas da faixa", () => {
    gravarZoom(USUARIO, ZOOM_MIN);
    render(<ZoomDoFio userId={USUARIO} />);
    expect(screen.getByTestId("zoom-do-fio-diminuir")).toBeDisabled();
    expect(screen.getByTestId("zoom-do-fio-aumentar")).toBeEnabled();

    fireEvent.click(screen.getByTestId("zoom-do-fio-aumentar"));
    expect(screen.getByTestId("zoom-do-fio-diminuir")).toBeEnabled();
  });
});
