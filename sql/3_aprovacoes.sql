-- =====================================================================
-- HYPERCONNECT — FLUXO DE APROVAÇÃO DE CONTAS
-- Roda DEPOIS de hyperconnect_supabase_schema.sql e
-- hyperconnect_notifications.sql.
--
-- Regra: 1) gerente/admin pode pré-cadastrar um e-mail + departamento
--           (team_invites) antes da pessoa se cadastrar -> aprovação automática
--        2) quem se cadastra sem estar pré-cadastrado entra com team = null
--           ("aguardando aprovação") até um gerente/admin definir o
--           departamento manualmente
-- =====================================================================

-- 1) profiles.team passa a aceitar null (conta pendente)
alter table public.profiles alter column team drop default;
alter table public.profiles alter column team drop not null;

-- 2) tabela de convites (pré-cadastro de e-mail + departamento)
create table if not exists public.team_invites (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  team        team_role not null,
  invited_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  used_at     timestamptz
);

alter table public.team_invites enable row level security;

create policy "team_invites: gerente/admin leem"
  on public.team_invites for select
  using (public.current_team() in ('gerente', 'admin'));

create policy "team_invites: gerente/admin criam"
  on public.team_invites for insert
  with check (public.current_team() in ('gerente', 'admin'));

create policy "team_invites: gerente/admin deletam"
  on public.team_invites for delete
  using (public.current_team() in ('gerente', 'admin'));

-- 3) handle_new_user passa a checar o convite pelo e-mail
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_invite public.team_invites%rowtype;
begin
  select * into v_invite from public.team_invites where email = new.email and used_at is null;

  insert into public.profiles (id, name, email, team, team_label)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    v_invite.team,  -- null se não houver convite -> fica "aguardando aprovação"
    new.raw_user_meta_data->>'team_label'
  );

  if v_invite.id is not null then
    update public.team_invites set used_at = now() where id = v_invite.id;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- 4) gerente/admin podem aprovar (atualizar o team de qualquer perfil)
drop policy if exists "profiles: gerente/admin aprovam contas pendentes" on public.profiles;
create policy "profiles: gerente/admin aprovam contas pendentes"
  on public.profiles for update
  using (public.current_team() in ('gerente', 'admin'));
