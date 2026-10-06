-- 0346: total de mensagens inbound por conversa para o foguinho de streak.
--
-- A régua do streak (lib/inbox/engajamento.ts) acende quando o contato mandou
-- 2+ mensagens e a última tem até 1h — e UMA mensagem sozinha nunca acende. A
-- lista do inbox e o quadro do Radar precisam desse total por conversa, e
-- trazer o histórico para contar no código seria trazer tudo para descartar
-- quase tudo (o mesmo motivo de `withConversas` não trazer todas as conversas
-- do contato). Por isso uma função agregadora, e não mais uma coluna: o total
-- muda a cada mensagem recebida, e coluna sincronizada por trigger para algo
-- que se computa on-demand é o anti-pattern nº 5.
--
-- `stable` + `security definer`: só LÊ (exceção da regra 2 do
-- hardening-definer-varredura, como os helpers de RLS). A organização NÃO vem
-- por argumento — vem de `fn_user_org_ids()`, como as policies: passar org por
-- parâmetro abriria leitura cross-tenant a qualquer `authenticated` (a lição
-- da #887). Revokes nas DUAS origens (public + o grant direto a anon do
-- default ACL) e grant só a quem chama com sessão ou servidor.
create or replace function public.fn_conversa_inbound_total(p_conversation_ids uuid[])
returns table (conversation_id uuid, inbound_total integer)
language sql
stable
security definer
set search_path = public
as $$
  select m.conversation_id, count(*)::integer
  from public.messages m
  where m.organization_id in (select public.fn_user_org_ids())
    and m.direction = 'inbound'
    and m.conversation_id = any (p_conversation_ids)
  group by m.conversation_id;
$$;

revoke execute on function public.fn_conversa_inbound_total(uuid[]) from public, anon;
grant execute on function public.fn_conversa_inbound_total(uuid[]) to authenticated, service_role;

comment on function public.fn_conversa_inbound_total(uuid[]) is
  'Total de mensagens inbound por conversa (foguinho de streak do Radar/inbox); org via fn_user_org_ids, nunca por argumento.';
