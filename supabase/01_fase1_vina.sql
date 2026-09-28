-- =====================================================================
-- VINA — Fase 1: perfil + consentimento LGPD, renda, despesas essenciais,
-- dívidas e pagamentos. Cada pessoa só enxerga os próprios dados (RLS).
-- Rodar inteiro no Supabase: SQL Editor > New query > colar > Run
-- =====================================================================

create type tipo_divida   as enum ('cartao_rotativo', 'cheque_especial', 'consignado', 'financiamento',
                                   'carne_pix_parcelado', 'emprestimo_pessoal', 'outro');
create type status_divida as enum ('em_dia', 'atrasada', 'negativada', 'renegociada', 'quitada');
create type metodo_plano  as enum ('avalanche', 'bola_de_neve', 'hibrido');
create type tipo_renda    as enum ('clt', 'autonomo', 'outro');

-- ---------- Tabelas ----------
create table public.perfis (
  id                    uuid primary key references auth.users (id) on delete cascade,
  nome                  text not null,
  consentimento_em      timestamptz,              -- LGPD: aceite explícito
  consentimento_versao  text,
  metodo                metodo_plano not null default 'hibrido',
  orcamento_dividas     numeric(12,2) check (orcamento_dividas >= 0),
  criado_em             timestamptz not null default now()
);

create table public.rendas (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  mes_referencia  date not null,                  -- sempre dia 1 do mês
  tipo            tipo_renda not null default 'clt',
  bruto           numeric(12,2) check (bruto >= 0),
  descontos       numeric(12,2) check (descontos >= 0),
  liquido         numeric(12,2) not null check (liquido >= 0),
  beneficios      jsonb not null default '[]',    -- [{ "nome": "VR", "valor": 600 }]
  criado_em       timestamptz not null default now(),
  unique (usuario_id, mes_referencia)
);

create table public.despesas (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  nome        text not null,
  valor       numeric(12,2) not null check (valor >= 0),
  criado_em   timestamptz not null default now()
);

create table public.dividas (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  nome            text not null,                  -- ex.: "Cartão Nubank"
  tipo            tipo_divida not null,
  saldo_inicial   numeric(12,2) not null check (saldo_inicial >= 0),
  saldo_atual     numeric(12,2) not null check (saldo_atual >= 0),
  juros_mensal    numeric(6,3) not null check (juros_mensal >= 0),   -- % ao mês
  juros_estimado  boolean not null default false,
  parcela_minima  numeric(12,2) not null default 0 check (parcela_minima >= 0),
  dia_vencimento  smallint check (dia_vencimento between 1 and 31),
  status          status_divida not null default 'em_dia',
  quitada_em      date,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
create index dividas_usuario_idx on public.dividas (usuario_id);

create table public.pagamentos (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  divida_id   uuid not null references public.dividas (id) on delete cascade,
  valor       numeric(12,2) not null check (valor > 0),
  data        date not null default current_date,
  criado_em   timestamptz not null default now()
);
create index pagamentos_divida_idx on public.pagamentos (divida_id);

-- ---------- Gatilhos ----------
create or replace function public.novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, nome)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger ao_criar_usuario
after insert on auth.users
for each row execute function public.novo_usuario();

-- Pagamento abate o saldo; se zerar, marca como quitada. Excluir pagamento desfaz.
create or replace function public.aplicar_pagamento() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update dividas
       set saldo_atual = greatest(saldo_atual - new.valor, 0),
           status      = case when saldo_atual - new.valor <= 0 then 'quitada'::status_divida else status end,
           quitada_em  = case when saldo_atual - new.valor <= 0 then new.data else quitada_em end,
           atualizado_em = now()
     where id = new.divida_id;
    return new;
  else
    update dividas
       set saldo_atual = saldo_atual + old.valor,
           status      = case when status = 'quitada' then 'em_dia'::status_divida else status end,
           quitada_em  = null,
           atualizado_em = now()
     where id = old.divida_id;
    return old;
  end if;
end $$;

create trigger pagamentos_aplicar
after insert or delete on public.pagamentos
for each row execute function public.aplicar_pagamento();

-- ---------- Segurança por linha (RLS): cada um só vê o que é seu ----------
alter table public.perfis     enable row level security;
alter table public.rendas     enable row level security;
alter table public.despesas   enable row level security;
alter table public.dividas    enable row level security;
alter table public.pagamentos enable row level security;

create policy perfis_proprio on public.perfis for select to authenticated using (id = auth.uid());
create policy perfis_editar  on public.perfis for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy rendas_proprio on public.rendas for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

create policy despesas_proprio on public.despesas for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

create policy dividas_proprio on public.dividas for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

create policy pagamentos_proprio on public.pagamentos for all to authenticated
  using (usuario_id = auth.uid())
  with check (
    usuario_id = auth.uid()
    and exists (select 1 from public.dividas d where d.id = divida_id and d.usuario_id = auth.uid())
  );

-- ---------- LGPD: a pessoa pode apagar a conta e todos os dados ----------
create or replace function public.excluir_meus_dados() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida.';
  end if;
  delete from auth.users where id = auth.uid();   -- cascata apaga perfil, renda, dívidas e pagamentos
end $$;

revoke execute on function public.excluir_meus_dados() from public, anon;
grant execute on function public.excluir_meus_dados() to authenticated;
