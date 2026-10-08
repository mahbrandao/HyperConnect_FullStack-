-- =====================================================================
-- HYPERCONNECT — CORREÇÃO: nomes de parâmetro errados nas chamadas de
-- create_notification() dentro dos triggers de projects/events/documents
-- e da checagem diária.
--
-- A função create_notification() tem os parâmetros chamados p_project_id,
-- p_event_id, p_document_id, p_link... mas os triggers estavam chamando
-- com project_id, event_id, document_id, link (sem o "p_"), e por isso o
-- Postgres não achava a função. Esse script substitui as 4 funções
-- afetadas pela versão corrigida. Pode rodar quantas vezes precisar.
-- =====================================================================

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
      p_direct_recipients := array_remove(array[new.vendedor_id, new.instalador_id], null)
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

  if new.instalador_id is distinct from old.instalador_id and new.instalador_id is not null then
    perform public.create_notification(
      'project_assigned',
      'Você foi definido(a) como instalador(a) responsável por ' || new.title || '.',
      p_project_id := new.id,
      p_link := '/projects/' || new.id,
      p_direct_recipients := array[new.instalador_id]
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
    case when v_project is not null then v_project.vendedor_id end,
    case when v_project is not null then v_project.instalador_id end
  ], null);

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
      p_direct_recipients := array_remove(array[r.vendedor_id, r.instalador_id], null)
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
      p_direct_recipients := array_remove(array[r.vendedor_id, r.instalador_id], null)
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
      p_direct_recipients := array_remove(array[r.instalador_id], null)
    );
  end loop;

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
      p_project_id := r.project_id, p_event_id := r.id, p_link := '/agenda',
      p_direct_recipients := array_remove(array[r.created_by, r.vendedor_id, r.instalador_id], null)
    );
  end loop;
end;
$$;
