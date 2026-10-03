/**
 * Tipos mínimos do `opus-media-recorder` (sem @types no npm).
 *
 * Só o que o gravador do inbox usa: construir com stream + mimeType ogg,
 * `start`/`stop`, eventos `ondataavailable`/`onstop` e `mimeType` real.
 * Mantido de propósito estreito — ampliar só quando um uso novo pedir.
 */
declare module "opus-media-recorder" {
  export interface OpusWorkerOptions {
    encoderWorkerFactory?: () => Worker;
    OggOpusEncoderWasmPath?: string;
    WebMOpusEncoderWasmPath?: string;
  }

  export interface OpusRecorderOptions {
    mimeType?: string;
    audioBitsPerSecond?: number;
  }

  export default class OpusMediaRecorder {
    constructor(
      stream: MediaStream,
      options?: OpusRecorderOptions,
      workerOptions?: OpusWorkerOptions,
    );
    readonly mimeType: string;
    readonly state: RecordingState;
    readonly stream: MediaStream;
    ondataavailable: ((e: BlobEvent) => void) | null;
    onstop: (() => void) | null;
    start(timeslice?: number): void;
    stop(): void;
  }
}
