-- 0344_galeria_de_midias.sql — Biblioteca de imagens da organização (Galeria).
--
-- Guarda SÓ o que o time subiu (chat outbound, fluxos de disparo, fluxos de
-- IA, upload direto na galeria). Imagem recebida do cliente (inbound) e
-- avatar de contato nunca entram: a origem é decidida por quem escreve
-- (rotas de upload), nunca por varredura do bucket.
--
-- Apagar um fluxo NÃO apaga a imagem (sem FK do grafo para cá, de propósito);
-- só a exclusão na Galeria remove o arquivo do bucket. Renomear muda só o
-- `nome` de exibição — o `storage_path` é estável, então fluxos e mensagens
-- que apontam para ele nunca quebram.

create table if not exists public.galeria_pastas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 60),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, nome)
);

create table if not exists public.galeria_arquivos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  storage_path text not null check (char_length(storage_path) between 1 and 500),
  nome text not null check (char_length(nome) between 1 and 120),
  mime text not null default 'image/jpeg',
  size_bytes integer not null default 0 check (size_bytes >= 0),
  largura integer check (largura is null or largura > 0),
  altura integer check (altura is null or altura > 0),
  origem text not null default 'galeria'
    check (origem in ('chat', 'disparo', 'fluxo', 'galeria')),
  pasta_id uuid references public.galeria_pastas(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, storage_path)
);

create index if not exists galeria_arquivos_org_pasta_idx
  on public.galeria_arquivos (organization_id, pasta_id, created_at desc);
create index if not exists galeria_arquivos_org_nome_idx
  on public.galeria_arquivos (organization_id, nome);

alter table public.galeria_pastas enable row level security;
alter table public.galeria_arquivos enable row level security;

drop policy if exists tenant_isolation_galeria_pastas_all on public.galeria_pastas;
create policy tenant_isolation_galeria_pastas_all on public.galeria_pastas
  for all using (organization_id in (select public.fn_user_org_ids()))
  with check (organization_id in (select public.fn_user_org_ids()));

drop policy if exists tenant_isolation_galeria_arquivos_all on public.galeria_arquivos;
create policy tenant_isolation_galeria_arquivos_all on public.galeria_arquivos
  for all using (organization_id in (select public.fn_user_org_ids()))
  with check (organization_id in (select public.fn_user_org_ids()));

-- O default ACL do Supabase concede tudo a anon/authenticated/service_role em
-- tabela nova de `public`: sem o revoke, a RLS seria a única camada para o
-- papel anônimo. Padrão da 0181.
revoke all on table public.galeria_pastas from anon;
revoke all on table public.galeria_arquivos from anon;

comment on table public.galeria_pastas is
  'Pastas da Galeria de imagens (organização do time; arquivos nunca são apagados junto).';
comment on table public.galeria_arquivos is
  'Imagens que o time subiu (chat, disparo, fluxo, galeria). Apagar aqui remove do bucket; apagar fluxo/mensagem não toca aqui.';

notify pgrst, 'reload schema';
