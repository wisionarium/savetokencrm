import { existsSync, statSync } from "node:fs";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * O gravador de voz usa `opus-media-recorder` (WASM) quando o navegador não
 * tem ogg nativo — worker + wasm servidos de `public/vendor`, sem bundler
 * no meio. Se um desses arquivos sumir, o Chrome volta a gravar webm e o
 * canal oficial recusa (131053). Este teste prende os três elos: arquivos
 * no disco, import dinâmico no componente e caminhos iguais nos dois.
 */
const WORKER = "public/vendor/opus-media-recorder/encoderWorker.umd.js";
const WASM = "public/vendor/opus-media-recorder/OggOpusEncoder.wasm";

describe("gravador ogg no navegador", () => {
  it("worker e wasm estão em public/vendor", () => {
    for (const f of [WORKER, WASM]) {
      expect(existsSync(f), `${f} ausente`).toBe(true);
      expect(statSync(f).size).toBeGreaterThan(10_000);
    }
  });

  it("AudioRecorder usa o polyfill só sem ogg nativo, nos mesmos caminhos", () => {
    const fonte = readFileSync("components/inbox/composer/AudioRecorder.tsx", "utf8");
    expect(fonte).toContain('"opus-media-recorder"');
    expect(fonte).toContain("/vendor/opus-media-recorder/encoderWorker.umd.js");
    expect(fonte).toContain("/vendor/opus-media-recorder/OggOpusEncoder.wasm");
    expect(fonte).toContain("audio/ogg;codecs=opus");
  });
});
