-- 0343_followup_inbox_enabled.sql — Adiciona toggle de exibição de fluxos na Caixa de Entrada
alter table public.followup_flow_pointers
  add column if not exists inbox_enabled boolean not null default false;

comment on column public.followup_flow_pointers.inbox_enabled is
  'Indica se este fluxo de disparo fica disponível na Caixa de Entrada (chat) para os atendentes dispararem diretamente aos clientes.';

notify pgrst, 'reload schema';
