-- =====================================================================
-- HYPERCONNECT — RODADA 2 DE AJUSTES
-- Roda depois de: schema.sql, notifications.sql, approvals.sql,
-- fix_notifications.sql
-- =====================================================================

-- 1) Prioridade vira Sim/Não (projeto prioritário ou não)
alter table public.projects add column if not exists is_priority boolean not null default false;
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'projects' and column_name = 'priority') then
    update public.projects set is_priority = true where priority = 'Alta';
    alter table public.projects drop column priority;
  end if;
end $$;

-- 2) Forma de pagamento
do $$ begin
  create type payment_method as enum ('Pix', 'Boleto', 'Cartão', 'Após instalação', 'Financiamento');
exception when duplicate_object then null; end $$;

alter table public.projects add column if not exists payment_method payment_method;

-- 3) Fotos do projeto (separadas de documentos — não têm doc_type/contrato)
create table if not exists public.project_photos (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  file_path   text not null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.project_photos enable row level security;

drop policy if exists "project_photos: autenticados leem" on public.project_photos;
create policy "project_photos: autenticados leem"
  on public.project_photos for select using (auth.role() = 'authenticated');

drop policy if exists "project_photos: autenticados inserem" on public.project_photos;
create policy "project_photos: autenticados inserem"
  on public.project_photos for insert with check (auth.role() = 'authenticated');

drop policy if exists "project_photos: autor ou gerente/admin deletam" on public.project_photos;
create policy "project_photos: autor ou gerente/admin deletam"
  on public.project_photos for delete
  using (uploaded_by = auth.uid() or public.current_team() in ('gerente', 'admin'));

insert into storage.buckets (id, name, public)
values ('project-photos', 'project-photos', false)
on conflict (id) do nothing;

drop policy if exists "project-photos bucket: autenticados leem" on storage.objects;
create policy "project-photos bucket: autenticados leem"
  on storage.objects for select
  using (bucket_id = 'project-photos' and auth.role() = 'authenticated');

drop policy if exists "project-photos bucket: autenticados fazem upload" on storage.objects;
create policy "project-photos bucket: autenticados fazem upload"
  on storage.objects for insert
  with check (bucket_id = 'project-photos' and auth.role() = 'authenticated');

drop policy if exists "project-photos bucket: dono ou gerente/admin deleta" on storage.objects;
create policy "project-photos bucket: dono ou gerente/admin deleta"
  on storage.objects for delete
  using (
    bucket_id = 'project-photos'
    and (owner = auth.uid() or public.current_team() in ('gerente', 'admin'))
  );

-- 4) Cadastro de funcionário já aprovado (criado pelo gerente/admin)
-- Quando o usuário é criado via API admin com "team" nos metadados,
-- o profile já nasce aprovado (sem precisar de convite/aprovação).
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_invite public.team_invites%rowtype;
  v_meta_team team_role;
begin
  v_meta_team := nullif(new.raw_user_meta_data->>'team', '')::team_role;

  if v_meta_team is not null then
    insert into public.profiles (id, name, email, team, team_label)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
      new.email,
      v_meta_team,
      new.raw_user_meta_data->>'team_label'
    );
    return new;
  end if;

  select * into v_invite from public.team_invites where email = new.email and used_at is null;

  insert into public.profiles (id, name, email, team, team_label)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    v_invite.team,
    new.raw_user_meta_data->>'team_label'
  );

  if v_invite.id is not null then
    update public.team_invites set used_at = now() where id = v_invite.id;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- 5) Permitir que quem criou o projeto (vendedor/instalador responsável)
--    também possa excluir, além de gerente/admin
drop policy if exists "projects: gerente/admin deleta" on public.projects;
drop policy if exists "projects: gerente/admin ou responsável deleta" on public.projects;
create policy "projects: gerente/admin ou responsável deleta"
  on public.projects for delete
  using (
    public.current_team() in ('gerente', 'admin')
    or vendedor_id = auth.uid()
    or instalador_id = auth.uid()
  );
