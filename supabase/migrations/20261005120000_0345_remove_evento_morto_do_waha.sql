-- Migration 0345: remove o tipo de evento morto do transporte QR.
--
-- `whatsapp.chat_id_not_recognized` era emitido pelo ingest do WAHA quando o
-- webhook chegava para um chat que o CRM não reconhecia. Com a remoção do
-- transporte (Vercel + Supabase Cloud, só Meta Cloud/Zernio), nenhum emissor
-- resta: nenhum `emit_event` literal no código e nenhuma montagem dinâmica o
-- produzem (test/unit/evento-de-fato-nao-fica-pendente.test.ts cobra isso).
--
-- Tipo sem emissor na lista de REGISTRO é configuração morta. Forward-fix
-- (nunca editar a 0239): `create or replace` só troca o corpo. Idempotente
-- por construção. Sem mudança de ACL, sem backfill.
create or replace function public.fn_event_log_e_registro(p_event_type text)
returns boolean
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select p_event_type = any (array[
    -- IA e agente
    'ai.responded',
    'ai_agent.created',
    'ai_agent.published',
    'ai_agent.run_completed',
    'ai_agent.run_failed',
    'ai_agent.run_started',
    -- agente (harness) — o motor registra quando não há negócio para pendurar
    'agent.activity_unrouted',
    -- canal e conversa
    'channel_session.status_changed',
    'conversation.claimed',
    'conversation.transferred',
    'whatsapp.conversation_mark_failed',
    -- contato, lead, organização e plataforma
    'contact.anonymized',
    'contact.created',
    'contact.deleted',
    'contact.updated',
    'crm.activity_write_failed',
    'incident.resolved',
    'lead.bulk_assigned',
    'lead.bulk_deleted',
    'lead.bulk_tagged',
    'lead.reopened',
    'lead.risk_backlog_seeded',
    'lead.updated',
    'org.updated',
    'tenant.onboarded',
    'tenant.reactivated',
    'tenant.suspended',
    'user.profile_updated',
    -- mensagem
    'message.failed',
    'message.outbound',
    'message.sending',
    'message.sent',
    -- LGPD
    'lgpd.export_delivered',
    'lgpd.export_generated',
    'lgpd.redact_applied',
    'lgpd.redact_failed'
  ]::text[]);
$$;
