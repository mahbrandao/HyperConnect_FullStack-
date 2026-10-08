-- =====================================================================
-- HYPERCONNECT — SISTEMA DE NOTIFICAÇÕES
-- Roda DEPOIS de hyperconnect_supabase_schema.sql (precisa das tabelas
-- profiles, projects, events, documents já criadas).
--
-- Cobre a "Fase 1" sugerida:
--   1. Projeto atribuído          6. Compromisso próximo
--   2. Mudança de etapa           7. Compromisso alterado/cancelado
--   3. Projeto atrasado           8. Documento pendente
--   4. Prazo próximo              9. Pagamento pendente
--   5. Novo compromisso          10. Pagamento recebido
-- (+ bônus de baixo custo: novo projeto, documento enviado)
--
-- Fases 2/3 (manutenção, clientes, equipe, sistema, segurança...) não
-- exigem alterar tabela nenhuma: basta inserir a nova linha em
-- notification_types (e, se quiser, em notification_routing) e criar
-- o trigger/checagem correspondente quando a feature existir de fato
-- (ex: quando "Manutenção" virar uma entidade própria).
-- =====================================================================

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
do $$ begin
  create type notification_category as enum (
    'projeto', 'agenda', 'pagamento', 'documento', 'equipe',
    'manutencao', 'cliente', 'sistema'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_severity as enum ('urgente', 'atencao', 'informativa', 'sucesso');
exception when duplicate_object then null; end $$;

-- status de evento (pra suportar "compromisso cancelado")
alter table public.events
  add column if not exists status text not null default 'agendado'
  check (status in ('agendado', 'concluido', 'cancelado'));

-- =====================================================================
-- 1. CATÁLOGO DE TIPOS
-- =====================================================================
create table if not exists public.notification_types (
  code              text primary key,               -- ex: 'project_stage_changed'
  category          notification_category not null,
  default_severity  notification_severity not null,
  label             text not null,                   -- nome amigável (pt-br)
  active            boolean not null default true
);

insert into public.notification_types (code, category, default_severity, label) values
  ('project_created',              'projeto',   'informativa', 'Novo projeto cadastrado'),
  ('project_assigned',             'projeto',   'informativa', 'Projeto atribuído'),
  ('project_stage_changed',        'projeto',   'informativa', 'Mudança de etapa'),
  ('project_overdue',              'projeto',   'urgente',     'Projeto atrasado'),
  ('project_deadline_approaching', 'projeto',   'atencao',     'Prazo próximo'),
  ('event_created',                'agenda',    'informativa', 'Novo compromisso'),
  ('event_updated',                'agenda',    'informativa', 'Compromisso alterado'),
  ('event_cancelled',              'agenda',    'urgente',     'Compromisso cancelado'),
  ('event_upcoming',               'agenda',    'atencao',     'Compromisso próximo'),
  ('document_uploaded',            'documento', 'informativa', 'Documento enviado'),
  ('document_pending',             'documento', 'urgente',     'Documento pendente'),
  ('payment_pending',              'pagamento', 'urgente',     'Pagamento pendente'),
  ('payment_received',             'pagamento', 'sucesso',     'Pagamento recebido')
on conflict (code) do nothing;

-- =====================================================================
-- 2. ROTEAMENTO — quais TIMES recebem cada tipo em broadcast
-- (além dos participantes diretos: vendedor/instalador/criador/etc,
-- que sempre recebem independente dessa tabela)
-- =====================================================================
create table if not exists public.notification_routing (
  type_code  text not null references public.notification_types(code) on delete cascade,
  team       team_role not null,
  primary key (type_code, team)
);

insert into public.notification_routing (type_code, team) values
  ('project_created',              'gerente'), ('project_created',              'admin'),
  ('project_assigned',             'gerente'),
  ('project_stage_changed',        'gerente'),
  ('project_overdue',              'gerente'),
  ('project_deadline_approaching', 'gerente'),
  ('event_created',                'gerente'),
  ('event_updated',                'gerente'),
  ('event_cancelled',              'gerente'),
  ('event_upcoming',               'gerente'),
  ('document_uploaded',            'gerente'), ('document_uploaded',            'admin'),
  ('document_pending',             'gerente'), ('document_pending',             'admin'),
  ('payment_pending',              'gerente'), ('payment_pending',              'admin'),
  ('payment_received',             'gerente'), ('payment_received',             'admin')
on conflict do nothing;

-- =====================================================================
-- 3. NOTIFICATIONS + NOTIFICATION_RECIPIENTS
-- =====================================================================
create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  type_code    text not null references public.notification_types(code),
  category     notification_category not null,
  severity     notification_severity not null,
  title        text not null,
  message      text,
  project_id   uuid references public.projects(id) on delete cascade,
  event_id     uuid references public.events(id) on delete cascade,
  document_id  uuid references public.documents(id) on delete cascade,
  employee_id  uuid references public.employees(id) on delete set null,
  link         text,          -- rota do front, ex: '/projects/<id>'
  created_at   timestamptz not null default now()
);

create index if not exists idx_notifications_project on public.notifications(project_id);
create index if not exists idx_notifications_type_created on public.notifications(type_code, created_at);

create table if not exists public.notification_recipients (
  notification_id  uuid not null references public.notifications(id) on delete cascade,
  profile_id       uuid not null references public.profiles(id) on delete cascade,
  read             boolean not null default false,
  read_at          timestamptz,
  primary key (notification_id, profile_id)
);

create index if not exists idx_notif_recipients_profile on public.notification_recipients(profile_id, read);

-- =====================================================================
-- 4. FUNÇÃO CENTRAL — cria a notificação e resolve os destinatários
-- =====================================================================
create or replace function public.create_notification(
  p_type_code         text,
  p_title             text,
  p_message           text default null,
  p_project_id        uuid default null,
  p_event_id          uuid default null,
  p_document_id       uuid default null,
  p_employee_id       uuid default null,
  p_link              text default null,
  p_direct_recipients uuid[] default '{}'::uuid[]
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category notification_category;
  v_severity notification_severity;
  v_notification_id uuid;
begin
  select category, default_severity into v_category, v_severity
  from public.notification_types
  where code = p_type_code and active = true;

  if v_category is null then
    -- tipo desconhecido ou inativo: não gera notificação, não quebra o app
    return null;
  end if;

  insert into public.notifications
    (type_code, category, severity, title, message, project_id, event_id, document_id, employee_id, link)
  values
    (p_type_code, v_category, v_severity, p_title, p_message, p_project_id, p_event_id, p_document_id, p_employee_id, p_link)
  returning id into v_notification_id;

  -- participantes diretos (removendo nulos/duplicados)
  insert into public.notification_recipients (notification_id, profile_id)
  select v_notification_id, r
  from unnest(p_direct_recipients) as r
  where r is not null
  on conflict do nothing;

  -- broadcast por time, segundo notification_routing
  insert into public.notification_recipients (notification_id, profile_id)
  select v_notification_id, p.id
  from public.profiles p
  join public.notification_routing nr on nr.team = p.team
  where nr.type_code = p_type_code
  on conflict do nothing;

  return v_notification_id;
end;
$$;

-- =====================================================================
-- 5. TRIGGERS — eventos "ao vivo"
-- =====================================================================

-- ---------- PROJECTS ----------
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
      project_id := new.id,
      link := '/projects/' || new.id,
      p_direct_recipients := array_remove(array[new.vendedor_id], null)
    );
    return new;
  end if;

  -- UPDATE
  if new.stage is distinct from old.stage then
    perform public.create_notification(
      'project_stage_changed',
      new.title || ' avançou para "' || new.stage || '".',
      project_id := new.id,
      link := '/projects/' || new.id,
      p_direct_recipients := array_remove(array[new.vendedor_id, new.instalador_id], null)
    );
  end if;

  if new.vendedor_id is distinct from old.vendedor_id and new.vendedor_id is not null then
    perform public.create_notification(
      'project_assigned',
      'Você foi definido(a) como vendedor(a) responsável por ' || new.title || '.',
      project_id := new.id,
      link := '/projects/' || new.id,
      p_direct_recipients := array[new.vendedor_id]
    );
  end if;

  if new.instalador_id is distinct from old.instalador_id and new.instalador_id is not null then
    perform public.create_notification(
      'project_assigned',
      'Você foi definido(a) como instalador(a) responsável por ' || new.title || '.',
      project_id := new.id,
      link := '/projects/' || new.id,
      p_direct_recipients := array[new.instalador_id]
    );
  end if;

  if new.data_pgto is not null and old.data_pgto is null then
    perform public.create_notification(
      'payment_received',
      'Pagamento de ' || new.client || ' referente a "' || new.title || '" foi registrado.',
      project_id := new.id,
      link := '/payments/' || new.id,
      p_direct_recipients := array_remove(array[new.vendedor_id], null)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_projects_notify on public.projects;
create trigger trg_projects_notify
  after insert or update on public.projects
  for each row execute function public.trg_fn_projects_notify();

-- ---------- EVENTS ----------
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
    case when v_project is not null then v_project.vendedor_id end,
    case when v_project is not null then v_project.instalador_id end
  ], null);

  if tg_op = 'INSERT' then
    perform public.create_notification(
      'event_created',
      new.title || ' agendado para ' || to_char(new.event_date, 'DD/MM/YYYY') || ' às ' || to_char(new.event_time, 'HH24:MI') || '.',
      project_id := new.project_id, event_id := new.id, link := '/agenda',
      p_direct_recipients := v_recipients
    );
    return new;
  end if;

  if new.status = 'cancelado' and old.status is distinct from 'cancelado' then
    perform public.create_notification(
      'event_cancelled',
      new.title || ' foi cancelado.',
      project_id := new.project_id, event_id := new.id, link := '/agenda',
      p_direct_recipients := v_recipients
    );
  elsif (new.event_date is distinct from old.event_date or new.event_time is distinct from old.event_time or new.title is distinct from old.title)
        and new.status <> 'cancelado' then
    perform public.create_notification(
      'event_updated',
      new.title || ' foi alterado para ' || to_char(new.event_date, 'DD/MM/YYYY') || ' às ' || to_char(new.event_time, 'HH24:MI') || '.',
      project_id := new.project_id, event_id := new.id, link := '/agenda',
      p_direct_recipients := v_recipients
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_events_notify on public.events;
create trigger trg_events_notify
  after insert or update on public.events
  for each row execute function public.trg_fn_events_notify();

-- ---------- DOCUMENTS ----------
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
    project_id := new.project_id, document_id := new.id, link := '/documents',
    p_direct_recipients := array_remove(array[new.uploaded_by], null)
  );
  return new;
end;
$$;

drop trigger if exists trg_documents_notify on public.documents;
create trigger trg_documents_notify
  after insert on public.documents
  for each row execute function public.trg_fn_documents_notify();

-- =====================================================================
-- 6. CHECAGENS DIÁRIAS — pendências que ninguém "dispara" (prazo,
-- atraso, pagamento, documento faltando). Cada checagem evita duplicar
-- o aviso se já notificou o mesmo projeto nos últimos N dias.
-- =====================================================================
create or replace function public.run_daily_notification_checks()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  -- 1) projetos atrasados (prazo passou e não está concluído)
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
      project_id := r.id, link := '/projects/' || r.id,
      p_direct_recipients := array_remove(array[r.vendedor_id, r.instalador_id], null)
    );
  end loop;

  -- 2) prazo se aproximando (próximos 3 dias, ainda não concluído)
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
      project_id := r.id, link := '/projects/' || r.id,
      p_direct_recipients := array_remove(array[r.vendedor_id, r.instalador_id], null)
    );
  end loop;

  -- 3) pagamentos pendentes (ainda há valor a receber)
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
      project_id := r.id, link := '/payments/' || r.id,
      p_direct_recipients := array_remove(array[r.vendedor_id], null)
    );
  end loop;

  -- 4) documento obrigatório (Contrato) faltando em projetos já aprovados
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
      project_id := r.id, link := '/documents',
      p_direct_recipients := array_remove(array[r.instalador_id], null)
    );
  end loop;

  -- 5) compromissos de amanhã
  for r in
    select e.*, p.vendedor_id, p.instalador_id
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
      project_id := r.project_id, event_id := r.id, link := '/agenda',
      p_direct_recipients := array_remove(array[r.created_by, r.vendedor_id, r.instalador_id], null)
    );
  end loop;
end;
$$;

-- Agendamento diário via pg_cron (opcional — precisa da extensão habilitada).
-- Se este bloco der erro de permissão, habilite manualmente em:
-- Dashboard do Supabase → Database → Extensions → pg_cron
do $$
begin
  create extension if not exists pg_cron with schema extensions;
  perform cron.schedule(
    'hyperconnect-daily-notifications',
    '0 8 * * *',  -- todo dia às 08:00 UTC — ajuste o fuso se quiser
    $cron$ select public.run_daily_notification_checks(); $cron$
  );
exception when insufficient_privilege or undefined_function then
  raise notice 'pg_cron não pôde ser configurado automaticamente. Habilite em Database > Extensions e rode o cron.schedule manualmente (veja comentário acima).';
end $$;

-- =====================================================================
-- 7. RLS
-- =====================================================================
alter table public.notification_types      enable row level security;
alter table public.notification_routing    enable row level security;
alter table public.notifications           enable row level security;
alter table public.notification_recipients enable row level security;

create policy "notification_types: autenticados leem"
  on public.notification_types for select using (auth.role() = 'authenticated');

create policy "notification_routing: autenticados leem"
  on public.notification_routing for select using (auth.role() = 'authenticated');

-- só vê a notificação quem é destinatário dela (via notification_recipients)
create policy "notifications: destinatário lê"
  on public.notifications for select
  using (
    exists (
      select 1 from public.notification_recipients nr
      where nr.notification_id = notifications.id and nr.profile_id = auth.uid()
    )
    or public.current_team() in ('gerente', 'admin')
  );

create policy "notification_recipients: usuário vê as próprias"
  on public.notification_recipients for select
  using (profile_id = auth.uid() or public.current_team() in ('gerente', 'admin'));

create policy "notification_recipients: usuário marca como lida"
  on public.notification_recipients for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- inserts em notifications/notification_recipients só via create_notification()
-- (security definer), então não abrimos policy de INSERT direta pra clientes.
