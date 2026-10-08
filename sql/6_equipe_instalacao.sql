-- =====================================================================
-- HYPERCONNECT — EQUIPE DE INSTALAÇÃO (vários instaladores por projeto)
-- Roda depois de 1..5. Pode rodar mais de uma vez.
-- =====================================================================

-- 1) Equipe de instalação do projeto
create table if not exists public.project_installers (
  project_id  uuid not null references public.projects(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (project_id, profile_id)
);
create index if not exists idx_project_installers_profile on public.project_installers(profile_id);
alter table public.project_installers enable row level security;

-- migra o instalador único que já existia (coluna projects.instalador_id fica
-- como legado, sem uso)
insert into public.project_installers (project_id, profile_id)
select id, instalador_id from public.projects where instalador_id is not null
on conflict do nothing;

-- 2) Funções auxiliares
create or replace function public.installer_ids(p_project uuid)
returns uuid[]
language sql stable security definer set search_path = public
as $$
  select coalesce(array_agg(profile_id), '{}'::uuid[]) from public.project_installers where project_id = p_project;
$$;

create or replace function public.can_manage_team(p_project uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.current_team() in ('gerente', 'admin')
      or exists (select 1 from public.projects p where p.id = p_project and p.vendedor_id = auth.uid());
$$;

-- 3) Permissões da equipe
drop policy if exists "project_installers: autenticados leem" on public.project_installers;
create policy "project_installers: autenticados leem"
  on public.project_installers for select using (auth.role() = 'authenticated');

drop policy if exists "project_installers: gerente/admin/vendedor adicionam" on public.project_installers;
create policy "project_installers: gerente/admin/vendedor adicionam"
  on public.project_installers for insert with check (public.can_manage_team(project_id));

drop policy if exists "project_installers: gerente/admin/vendedor removem" on public.project_installers;
create policy "project_installers: gerente/admin/vendedor removem"
  on public.project_installers for delete using (public.can_manage_team(project_id));

-- 4) Projetos: instaladores da equipe podem editar; só gerente/admin/vendedor excluem
drop policy if exists "projects: gerente/admin ou responsável atualiza" on public.projects;
create policy "projects: gerente/admin ou responsável atualiza"
  on public.projects for update
  using (
    public.current_team() in ('gerente', 'admin')
    or vendedor_id = auth.uid()
    or exists (select 1 from public.project_installers pi where pi.project_id = projects.id and pi.profile_id = auth.uid())
  );

drop policy if exists "projects: gerente/admin ou responsável deleta" on public.projects;
create policy "projects: gerente/admin ou vendedor deleta"
  on public.projects for delete
  using (public.current_team() in ('gerente', 'admin') or vendedor_id = auth.uid());

-- 5) Todos os usuários logados precisam ver o NOME dos colegas (vendedor/equipe
-- aparecem nos projetos). Antes, vendas/instalação só enxergavam o próprio perfil.
drop policy if exists "profiles: autenticados leem" on public.profiles;
create policy "profiles: autenticados leem"
  on public.profiles for select using (auth.role() = 'authenticated');

-- 6) Aviso quando alguém entra na equipe de um projeto
create or replace function public.trg_fn_installers_notify()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_title text;
begin
  select title into v_title from public.projects where id = new.project_id;
  perform public.create_notification(
    'project_assigned',
    'Você foi adicionado(a) à equipe de instalação de ' || coalesce(v_title, 'um projeto') || '.',
    p_project_id := new.project_id,
    p_link := '/projects/' || new.project_id,
    p_direct_recipients := array[new.profile_id]
  );
  return new;
end;
$$;

drop trigger if exists trg_installers_notify on public.project_installers;
create trigger trg_installers_notify
  after insert on public.project_installers
  for each row execute function public.trg_fn_installers_notify();

-- 7) Notificações passam a avisar TODA a equipe de instalação
create or replace function public.trg_fn_projects_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.create_notification(
      'project_created',
      new.title || ' foi cadastrado (' || new.client || ').',
      p_project_id := new.id,
      p_link := '/projects/' || new.id,
      p_direct_recipients := array_remove(array[new.vendedor_id], null)
    );
    return new;
  end if;

  if new.stage is distinct from old.stage then
    perform public.create_notification(
      'project_stage_changed',
      new.title || ' avançou para "' || new.stage || '".',
      p_project_id := new.id,
      p_link := '/projects/' || new.id,
      p_direct_recipients := (array_remove(array[new.vendedor_id], null) || public.installer_ids(new.id))
    );
  end if;

  if new.vendedor_id is distinct from old.vendedor_id and new.vendedor_id is not null then
    perform public.create_notification(
      'project_assigned',
      'Você foi definido(a) como vendedor(a) responsável por ' || new.title || '.',
      p_project_id := new.id,
      p_link := '/projects/' || new.id,
      p_direct_recipients := array[new.vendedor_id]
    );
  end if;

  if new.data_pgto is not null and old.data_pgto is null then
    perform public.create_notification(
      'payment_received',
      'Pagamento de ' || new.client || ' referente a "' || new.title || '" foi registrado.',
      p_project_id := new.id,
      p_link := '/payments/' || new.id,
      p_direct_recipients := array_remove(array[new.vendedor_id], null)
    );
  end if;

  return new;
end;
$$;

create or replace function public.trg_fn_events_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project record;
  v_recipients uuid[];
begin
  select vendedor_id, instalador_id into v_project
  from public.projects where id = coalesce(new.project_id, old.project_id);

  v_recipients := array_remove(array[
    new.created_by,
    case when v_project is not null then v_project.vendedor_id end
  ], null) || public.installer_ids(coalesce(new.project_id, old.project_id));

  if tg_op = 'INSERT' then
    perform public.create_notification(
      'event_created',
      new.title || ' agendado para ' || to_char(new.event_date, 'DD/MM/YYYY') || ' às ' || to_char(new.event_time, 'HH24:MI') || '.',
      p_project_id := new.project_id, p_event_id := new.id, p_link := '/agenda',
      p_direct_recipients := v_recipients
    );
    return new;
  end if;

  if new.status = 'cancelado' and old.status is distinct from 'cancelado' then
    perform public.create_notification(
      'event_cancelled',
      new.title || ' foi cancelado.',
      p_project_id := new.project_id, p_event_id := new.id, p_link := '/agenda',
      p_direct_recipients := v_recipients
    );
  elsif (new.event_date is distinct from old.event_date or new.event_time is distinct from old.event_time or new.title is distinct from old.title)
        and new.status <> 'cancelado' then
    perform public.create_notification(
      'event_updated',
      new.title || ' foi alterado para ' || to_char(new.event_date, 'DD/MM/YYYY') || ' às ' || to_char(new.event_time, 'HH24:MI') || '.',
      p_project_id := new.project_id, p_event_id := new.id, p_link := '/agenda',
      p_direct_recipients := v_recipients
    );
  end if;

  return new;
end;
$$;

create or replace function public.trg_fn_documents_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.create_notification(
    'document_uploaded',
    new.name || ' foi enviado.',
    p_project_id := new.project_id, p_document_id := new.id, p_link := '/documents',
    p_direct_recipients := array_remove(array[new.uploaded_by], null)
  );
  return new;
end;
$$;

create or replace function public.run_daily_notification_checks()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select * from public.projects
    where end_date < current_date and stage <> 'Concluído'
      and not exists (
        select 1 from public.notifications n
        where n.project_id = projects.id and n.type_code = 'project_overdue'
          and n.created_at > now() - interval '3 days'
      )
  loop
    perform public.create_notification(
      'project_overdue',
      r.title || ' está atrasado (prazo era ' || to_char(r.end_date, 'DD/MM/YYYY') || ').',
      p_project_id := r.id, p_link := '/projects/' || r.id,
      p_direct_recipients := (array_remove(array[r.vendedor_id], null) || public.installer_ids(r.id))
    );
  end loop;

  for r in
    select * from public.projects
    where end_date between current_date and current_date + 3 and stage <> 'Concluído'
      and not exists (
        select 1 from public.notifications n
        where n.project_id = projects.id and n.type_code = 'project_deadline_approaching'
          and n.created_at > now() - interval '3 days'
      )
  loop
    perform public.create_notification(
      'project_deadline_approaching',
      r.title || ' vence em breve (' || to_char(r.end_date, 'DD/MM/YYYY') || ').',
      p_project_id := r.id, p_link := '/projects/' || r.id,
      p_direct_recipients := (array_remove(array[r.vendedor_id], null) || public.installer_ids(r.id))
    );
  end loop;

  for r in
    select * from public.projects
    where coalesce(valor_a_receber, 0) > 0 and stage <> 'Concluído'
      and not exists (
        select 1 from public.notifications n
        where n.project_id = projects.id and n.type_code = 'payment_pending'
          and n.created_at > now() - interval '5 days'
      )
  loop
    perform public.create_notification(
      'payment_pending',
      r.client || ' tem R$ ' || to_char(r.valor_a_receber, 'FM999G999G990D00') || ' a receber no projeto "' || r.title || '".',
      p_project_id := r.id, p_link := '/payments/' || r.id,
      p_direct_recipients := array_remove(array[r.vendedor_id], null)
    );
  end loop;

  for r in
    select * from public.projects
    where stage in ('Aprovado', 'Em Instalação') and priority <> 'Baixa'
      and not exists (select 1 from public.documents d where d.project_id = projects.id and d.doc_type = 'Contrato')
      and not exists (
        select 1 from public.notifications n
        where n.project_id = projects.id and n.type_code = 'document_pending'
          and n.created_at > now() - interval '5 days'
      )
  loop
    perform public.create_notification(
      'document_pending',
      r.title || ' ainda não possui o contrato anexado.',
      p_project_id := r.id, p_link := '/documents',
      p_direct_recipients := public.installer_ids(r.id)
    );
  end loop;

  for r in
    select e.*, p.vendedor_id
    from public.events e
    left join public.projects p on p.id = e.project_id
    where e.event_date = current_date + 1 and e.status = 'agendado'
      and not exists (
        select 1 from public.notifications n
        where n.event_id = e.id and n.type_code = 'event_upcoming'
      )
  loop
    perform public.create_notification(
      'event_upcoming',
      r.title || ' amanhã às ' || to_char(r.event_time, 'HH24:MI') || '.',
      p_project_id := r.project_id, p_event_id := r.id, p_link := '/agenda',
      p_direct_recipients := (array_remove(array[r.created_by, r.vendedor_id], null) || public.installer_ids(r.project_id))
    );
  end loop;
end;
$$;
