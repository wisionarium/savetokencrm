/**
 * Task 5 do seam de canais â€” a capability do canal desarma o anti-ban, e a
 * inaplicabilidade VAI PARA O TRACE (invariante 4 de
 * `docs/doctrine/restricao-de-canal.md`): `skipped: 'not_applicable'` nunca Ã© um
 * `pass` silencioso, porque a diferenÃ§a entre "nÃ£o regrediu" e "consigo provar
 * que nÃ£o regrediu" Ã© exatamente essa linha em `before_send_traces`.
 *
 * O segundo bloco prova o invariante 3 pelo GATE (nÃ£o sÃ³ pelo motor): num canal
 * sem risco de ban, a CORTESIA (janela/domingo/fuso) continua armada. Ã‰ o caso
 * que reprova a implementaÃ§Ã£o Ã³bvia â€” `if (!caps.banRisk) return { pass: true }`
 * antes de `decidePacing` â€” que apagaria o horÃ¡rio comercial junto com o
 * throttle e faria a IA acordar cliente Ã s 3h.
 */
import type pg from 'pg';
import { describe, expect, it, vi } from 'vitest';

import {
  pacingGate,
  runBeforeSend,
  type Gate,
  type GateContext,
} from '@/lib/agent-engine/guardrails/before-send';
import { PACING_DEFAULTS } from '@/lib/agent-engine/pacing/defaults';
import { SPINNING_DEFAULTS } from '@/lib/agent-engine/spinning/defaults';
import type { Logger } from '@/lib/agent-engine/obs/logger';

const COMERCIAL = new Date('2026-07-28T13:00:00Z'); // 10h BRT, terÃ§a â€” dentro da janela
const MADRUGADA = new Date('2026-07-28T06:00:00Z'); // 03h BRT â€” fora da janela

// Espelha o baseCtx de tests/invariants/case-guardrail.test.ts:32 (o repo nÃ£o tem
// fixture compartilhada de GateContext â€” cada teste de gate monta a sua).
function baseCtx(overrides: Partial<GateContext> = {}): GateContext {
  return {
    now: COMERCIAL,
    body: 'oi',
    optedOut: false,
    provider: 'meta_cloud',
    pacing: {
      knobs: PACING_DEFAULTS,
      state: { lastSentAt: null, sentToday: 0, numberActivatedAt: null },
      crmDailyLimit: null,
      rng: () => 0,
    },
    spinning: { knobs: SPINNING_DEFAULTS, window: [] },
    promise: { table: null },
    semanticPromise: null,
    disclosure: { template: null, isFirstOutbound: false, mode: 'inject' },
    lgpd: null,
    casesEnabled: false,
    hasOpenCase: false,
    openedCaseThisTurn: false,
    ...overrides,
  };
}

describe('gate de pacing respeita a capability do canal', () => {
  it('em canal SEM risco de ban, o gate registra skipped â€” nÃ£o pass silencioso', () => {
    const v = pacingGate.evaluate(baseCtx({ provider: 'meta_cloud' }));
    expect(v.pass).toBe(true);
    if (!v.pass) throw new Error('inalcanÃ§Ã¡vel');
    expect(v.skipped).toBe('not_applicable');
  });

  it('provider legado (waha) falha fechado — nunca avalia como canal atual', () => {
    expect(() => pacingGate.evaluate(baseCtx({ provider: 'waha' as never }))).toThrow(/unknown_channel_provider/);
  });

  it('sem risco de ban, o cap anti-ban desarma nos dois canais (meta e zernio)', () => {
    const estourado = {
      knobs: PACING_DEFAULTS,
      state: { lastSentAt: null, sentToday: 999, numberActivatedAt: null },
      crmDailyLimit: null,
      rng: () => 0,
    };
    for (const provider of ['meta_cloud', 'zernio'] as const) {
      const v = pacingGate.evaluate(baseCtx({ provider, pacing: estourado }));
      expect(v.pass).toBe(true);
      if (!v.pass) throw new Error('inalcancavel');
      expect(v.skipped).toBe('not_applicable');
    }
  });
  it('invariante 3: sem risco de ban, a CORTESIA (janela) continua vetando', () => {
    const v = pacingGate.evaluate(baseCtx({ provider: 'meta_cloud', now: MADRUGADA }));
    expect(v.pass).toBe(false);
    if (v.pass) throw new Error('inalcanÃ§Ã¡vel');
    expect(v.code).toBe('outside_window');
  });
});

/**
 * A propagaÃ§Ã£o. O veredito `skipped` sÃ³ cumpre o invariante 4 se sobreviver ao
 * runner e chegar ao INSERT em `before_send_traces` â€” morrer no meio virando
 * `pass` seria falhar no propÃ³sito da task com os testes acima verdes.
 *
 * O provider ainda nÃ£o vem do banco (`channel_sessions.provider` Ã© da Task 6): o
 * ctx de produÃ§Ã£o fixa 'waha'. Para exercitar o ramo pelo caminho REAL, a cadeia
 * injetada delega ao `pacingGate` de verdade com o provider trocado â€” o que se
 * mede aqui Ã© o runner e a escrita do trace, nÃ£o um gate de mentira.
 */
describe('o skipped do gate chega em before_send_traces', () => {
  it('a linha persistida traz verdict=skipped e code=not_applicable', async () => {
    const canalSemBan: Gate = {
      name: 'pacing',
      evaluate: (ctx) => pacingGate.evaluate({ ...ctx, provider: 'meta_cloud' }),
    };
    const client = { query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() };
    const persisted = vi.fn().mockResolvedValue({ rows: [{ id: 'trace-1' }] });
    const pool = { connect: vi.fn().mockResolvedValue(client), query: persisted } as unknown as pg.Pool;
    const log: Logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    const result = await runBeforeSend({
      pool,
      log,
      tenantId: '00000000-0000-4000-8000-000000000001',
      leadId: '00000000-0000-4000-8000-000000000002',
      jobId: '00000000-0000-4000-8000-000000000003',
      channelSessionId: '00000000-0000-4000-8000-000000000004',
      body: 'oi',
      optedOutThisTurn: false,
      crmDailyLimit: null,
      now: COMERCIAL,
      rng: () => 0,
      gates: [canalSemBan],
      send: async () => ({ kind: 'sent', idempotencyKey: 'k', messageId: 'm' }),
    });

    expect(result.status).toBe('sent');
    expect(result.trace).toEqual([{ gate: 'pacing', verdict: 'skipped', code: 'not_applicable' }]);

    const insert = persisted.mock.calls.find(([sql]) => String(sql).includes('before_send_traces'));
    expect(insert).toBeDefined();
    // params[4] = jsonb do trace: Ã© ESTA linha que o auditor lÃª depois.
    expect(JSON.parse(insert![1][4])).toEqual([
      { gate: 'pacing', verdict: 'skipped', code: 'not_applicable' },
    ]);
  });

  /**
   * Task 6 fechou a Ãºltima suposiÃ§Ã£o: o ctx de produÃ§Ã£o lÃª
   * `channel_sessions.provider` (migration 0087) em vez de fixar 'waha'.
   *
   * O teste acima injeta um gate que TROCA o provider â€” ele mede o runner, nÃ£o a
   * origem do valor. Este mede a origem: a cadeia Ã© o `pacingGate` REAL, sem
   * injeÃ§Ã£o, e o Ãºnico motivo de o veredito sair `skipped` Ã© o banco ter
   * respondido `meta_cloud`. Com o literal de volta no lugar da consulta, sai
   * `pass` e isto fica vermelho.
   */
  async function rodaComProviderNoBanco(provider: string) {
    // O cap ESTOURADO Ã© o que torna a origem do provider observÃ¡vel: em 'waha' o
    // anti-ban veta; em 'meta_cloud' ele desarma e o envio passa. Dentro da janela
    // comercial, para que a cortesia (que vale nos dois canais) nÃ£o decida o
    // desfecho e mascare a diferenÃ§a.
    const client = {
      query: vi.fn(async (sql: string) => {
        const q = String(sql);
        if (q.includes('from channel_sessions')) return { rows: [{ provider }] };
        if (q.includes('from pacing_ledger')) return { rows: [{ last_sent_at: null, sent_today: '999' }] };
        // Janela de 24h ABERTA: meta_cloud exige janela (o legado waha pulava
        // o gate); sem inbound o messaging_window vetaria antes do pacing.
        if (q.includes('select last_inbound_at from conversations'))
          return { rows: [{ last_inbound_at: new Date('2026-07-28T12:00:00Z') }] };
        return { rows: [] };
      }),
      release: vi.fn(),
    };
    const persisted = vi.fn().mockResolvedValue({ rows: [{ id: 'trace-1' }] });
    const pool = { connect: vi.fn().mockResolvedValue(client), query: persisted } as unknown as pg.Pool;
    const log: Logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    return runBeforeSend({
      pool,
      log,
      tenantId: '00000000-0000-4000-8000-000000000001',
      leadId: '00000000-0000-4000-8000-000000000002',
      jobId: '00000000-0000-4000-8000-000000000003',
      channelSessionId: '00000000-0000-4000-8000-000000000004',
      body: 'oi',
      optedOutThisTurn: false,
      crmDailyLimit: null,
      now: COMERCIAL,
      rng: () => 0,
      sleep: async () => {},
      gates: [pacingGate],
      send: async () => ({ kind: 'sent', idempotencyKey: 'k', messageId: 'm' }),
    });
  }

  it('o provider do ctx sai de channel_sessions, nÃ£o de literal', async () => {
    // Sem injeÃ§Ã£o de gate: a cadeia Ã© o `pacingGate` REAL, e a ÃšNICA variÃ¡vel
    // entre as duas rodadas Ã© a linha que o banco devolve. Com o literal de volta
    // no lugar da consulta, as duas rodadas dariam o mesmo desfecho e o par abaixo
    // ficaria vermelho.
    const meta = await rodaComProviderNoBanco('meta_cloud');
    expect(meta.status).toBe('sent');
    expect(meta.trace).toEqual([{ gate: 'pacing', verdict: 'skipped', code: 'not_applicable' }]);

    // Linha legada waha no banco: o gate lanca fail-closed e o runner
    // propaga — nunca envia nem veta silencioso por um canal que nao existe.
    await expect(rodaComProviderNoBanco('waha')).rejects.toThrow(/unknown_channel_provider/);
  });
});
