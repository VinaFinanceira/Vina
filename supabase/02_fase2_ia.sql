-- =====================================================================
-- VINA — Fase 2: IA (assistente, fotos, voz) + metas de compra
-- Rodar DEPOIS do 01_fase1_vina.sql. SQL Editor > New query > Run
-- =====================================================================

create type status_meta as enum ('ativa', 'concluida', 'cancelada');

-- Metas de compra ("Posso comprar isso?" / foto de produto)
create table public.metas_compra (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  nome            text not null,
  valor_alvo      numeric(12,2) not null check (valor_alvo > 0),
  valor_guardado  numeric(12,2) not null default 0 check (valor_guardado >= 0),
  aporte_mensal   numeric(12,2) check (aporte_mensal >= 0),
  caminho         text,                    -- caminho escolhido na conversa com a VINA
  origem          text not null default 'manual',   -- manual | vina
  status          status_meta not null default 'ativa',
  criado_em       timestamptz not null default now()
);
create index metas_usuario_idx on public.metas_compra (usuario_id);

alter table public.metas_compra enable row level security;
create policy metas_proprio on public.metas_compra for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Controle de uso da IA por pessoa por dia (protege seu custo)
create table public.uso_ia (
  usuario_id  uuid not null references public.perfis (id) on delete cascade,
  dia         date not null default (now() at time zone 'America/Sao_Paulo')::date,
  chamadas    integer not null default 0,
  primary key (usuario_id, dia)
);
alter table public.uso_ia enable row level security;
create policy uso_ler on public.uso_ia for select to authenticated using (usuario_id = auth.uid());

-- Soma 1 chamada e diz se ainda está dentro do limite do dia
create or replace function public.registrar_uso_ia(p_limite integer)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_total integer;
begin
  if auth.uid() is null then
    return false;
  end if;
  insert into uso_ia (usuario_id, dia, chamadas)
  values (auth.uid(), (now() at time zone 'America/Sao_Paulo')::date, 1)
  on conflict (usuario_id, dia) do update set chamadas = uso_ia.chamadas + 1
  returning chamadas into v_total;
  return v_total <= p_limite;
end $$;

revoke execute on function public.registrar_uso_ia(integer) from public, anon;
grant execute on function public.registrar_uso_ia(integer) to authenticated;
