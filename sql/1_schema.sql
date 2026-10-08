-- =====================================================================
-- HYPERCONNECT — SCHEMA SUPABASE
-- Baseado no front-end atual (HyperConnect-next), que hoje usa dados
-- mockados em data/mockData.ts, components/pages/Employees.tsx,
-- Documents.tsx, Agenda.tsx e Payments.tsx.
--
-- Como rodar:
--   1. Abra o SQL Editor do seu projeto Supabase
--   2. Cole este arquivo inteiro e execute (Run)
--   3. Confira em Table Editor se as tabelas foram criadas
--
-- Este script é idempotente: pode rodar mais de uma vez sem quebrar
-- (usa IF NOT EXISTS / OR REPLACE onde possível).
-- =====================================================================

-- ---------------------------------------------------------------------
-- EXTENSÕES
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ---------------------------------------------------------------------
-- ENUMS
-- (espelham os `type` do TypeScript em interfaces/*.ts e nas páginas)
-- ---------------------------------------------------------------------
do $$ begin
  create type team_role as enum ('gerente', 'admin', 'vendas', 'instalacao');
exception when duplicate_object then null; end $$;

do $$ begin
  create type project_stage as enum (
    'Orçamento', 'Aprovado', 'Em Instalação', 'Manutenção', 'Concluído'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type project_priority as enum ('Alta', 'Média', 'Baixa');
exception when duplicate_object then null; end $$;

do $$ begin
  create type employee_status as enum ('Ativo', 'Inativo', 'Férias');
exception when duplicate_object then null; end $$;

do $$ begin
  create type event_type as enum (
    'Visita técnica', 'Reunião', 'Instalação', 'Manutenção', 'Outros'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type document_type as enum (
    'Contrato', 'Projeto', 'Técnico', 'Orçamento', 'Fiscal', 'Manual', 'Termo', 'Outros'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- HELPER: updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =====================================================================
-- 1. PROFILES
-- Usuários que fazem login no sistema (equivalente ao USERS do
-- providers/UserProvider.tsx: gerente, admin, vendas, instalacao).
-- Estende auth.users do Supabase 1:1.
-- =====================================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  team        team_role not null default 'vendas',
  team_label  text,
  avatar      text,          -- iniciais ou URL da foto
  phone       text,
  email       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- cria o profile automaticamente quando alguém se cadastra (Register.tsx)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, team, team_label)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'team')::team_role, 'vendas'),
    new.raw_user_meta_data->>'team_label'
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- 2. EMPLOYEES
-- Cadastro de RH (Employees.tsx) — NÃO tem login, é só cadastro interno.
-- =====================================================================
create table if not exists public.employees (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  phone       text,
  role        text not null,        -- cargo (ex: "Técnico de Campo")
  department  text not null,        -- ex: "Instalações"
  since       date not null,        -- data de admissão
  status      employee_status not null default 'Ativo',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_employees_updated_at on public.employees;
create trigger trg_employees_updated_at
  before update on public.employees
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 3. PROJECTS
-- Projeto/serviço (Projects.tsx, Payments.tsx, data/mockData.ts).
-- `client` fica como texto simples, igual ao mock atual.
-- =====================================================================
create table if not exists public.projects (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  client           text not null,               -- nome do cliente (texto livre)
  type             text not null,                -- ex: "Instalação fotovoltaica"
  stage            project_stage not null default 'Orçamento',
  progress         smallint not null default 0 check (progress between 0 and 100),
  vendedor_id      uuid references public.profiles(id) on delete set null,
  instalador_id    uuid references public.profiles(id) on delete set null,
  start_date       date,
  end_date         date,
  img              text,                         -- URL da imagem/capa
  priority         project_priority not null default 'Média',
  value            numeric(12,2) not null default 0,
  valor_sistema    numeric(12,2),
  valor_mo         numeric(12,2),
  valor_a_receber  numeric(12,2),
  data_pgto        date,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create index if not exists idx_projects_stage on public.projects(stage);
create index if not exists idx_projects_vendedor on public.projects(vendedor_id);
create index if not exists idx_projects_instalador on public.projects(instalador_id);

-- =====================================================================
-- 4. DOCUMENTS
-- Documentos de projeto (Documents.tsx). O arquivo em si fica no
-- Supabase Storage (bucket "documents"), aqui guardamos só os metadados.
-- =====================================================================
create table if not exists public.documents (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  project_id   uuid references public.projects(id) on delete set null,
  doc_type     document_type not null default 'Outros',
  file_path    text not null,       -- caminho dentro do bucket "documents"
  file_size    bigint,              -- em bytes
  uploaded_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_documents_project on public.documents(project_id);

-- =====================================================================
-- 5. EVENTS (Agenda)
-- Compromissos da agenda (Agenda.tsx).
-- =====================================================================
create table if not exists public.events (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid references public.projects(id) on delete set null,
  title        text not null,
  subtitle     text,               -- campo "sub" no front (local/descrição)
  event_type   event_type not null default 'Outros',
  event_date   date not null,
  event_time   time not null,
  color        text,               -- "yellow" | "blue" | "purple" | "green" | "orange"
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_events_date on public.events(event_date);
create index if not exists idx_events_project on public.events(project_id);

-- =====================================================================
-- ROW LEVEL SECURITY (RLS)
-- Regras iniciais e razoáveis pros 4 perfis do app. Ajuste conforme
-- a necessidade real do negócio.
-- =====================================================================
alter table public.profiles  enable row level security;
alter table public.employees enable row level security;
alter table public.projects  enable row level security;
alter table public.documents enable row level security;
alter table public.events    enable row level security;

-- helper: pega o team do usuário logado
create or replace function public.current_team()
returns team_role as $$
  select team from public.profiles where id = auth.uid();
$$ language sql stable security definer set search_path = public;

-- ---------- PROFILES ----------
create policy "profiles: usuário vê o próprio perfil"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles: gerente/admin veem todos"
  on public.profiles for select
  using (public.current_team() in ('gerente', 'admin'));

create policy "profiles: usuário edita o próprio perfil"
  on public.profiles for update
  using (id = auth.uid());

-- ---------- EMPLOYEES (só gerente/admin gerenciam; todo mundo lê) ----------
create policy "employees: qualquer autenticado lê"
  on public.employees for select
  using (auth.role() = 'authenticated');

create policy "employees: gerente/admin insere"
  on public.employees for insert
  with check (public.current_team() in ('gerente', 'admin'));

create policy "employees: gerente/admin atualiza"
  on public.employees for update
  using (public.current_team() in ('gerente', 'admin'));

create policy "employees: gerente/admin deleta"
  on public.employees for delete
  using (public.current_team() in ('gerente', 'admin'));

-- ---------- PROJECTS ----------
create policy "projects: qualquer autenticado lê"
  on public.projects for select
  using (auth.role() = 'authenticated');

create policy "projects: gerente/admin/vendas cria"
  on public.projects for insert
  with check (public.current_team() in ('gerente', 'admin', 'vendas'));

create policy "projects: gerente/admin ou responsável atualiza"
  on public.projects for update
  using (
    public.current_team() in ('gerente', 'admin')
    or vendedor_id = auth.uid()
    or instalador_id = auth.uid()
  );

create policy "projects: gerente/admin deleta"
  on public.projects for delete
  using (public.current_team() in ('gerente', 'admin'));

-- ---------- DOCUMENTS ----------
create policy "documents: qualquer autenticado lê"
  on public.documents for select
  using (auth.role() = 'authenticated');

create policy "documents: qualquer autenticado insere"
  on public.documents for insert
  with check (auth.role() = 'authenticated');

create policy "documents: autor ou gerente/admin deleta"
  on public.documents for delete
  using (
    uploaded_by = auth.uid()
    or public.current_team() in ('gerente', 'admin')
  );

-- ---------- EVENTS ----------
create policy "events: qualquer autenticado lê"
  on public.events for select
  using (auth.role() = 'authenticated');

create policy "events: qualquer autenticado insere"
  on public.events for insert
  with check (auth.role() = 'authenticated');

create policy "events: autor ou gerente/admin atualiza"
  on public.events for update
  using (
    created_by = auth.uid()
    or public.current_team() in ('gerente', 'admin')
  );

create policy "events: autor ou gerente/admin deleta"
  on public.events for delete
  using (
    created_by = auth.uid()
    or public.current_team() in ('gerente', 'admin')
  );

-- =====================================================================
-- STORAGE — bucket para os arquivos de Documents.tsx
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "documents bucket: autenticados leem"
  on storage.objects for select
  using (bucket_id = 'documents' and auth.role() = 'authenticated');

create policy "documents bucket: autenticados fazem upload"
  on storage.objects for insert
  with check (bucket_id = 'documents' and auth.role() = 'authenticated');

create policy "documents bucket: dono ou gerente/admin deleta"
  on storage.objects for delete
  using (
    bucket_id = 'documents'
    and (owner = auth.uid() or public.current_team() in ('gerente', 'admin'))
  );

-- =====================================================================
-- SEED (opcional) — mesmos dados do mockData.ts, pra você já ver algo
-- populado no Table Editor. Comente/apague este bloco se não quiser.
-- =====================================================================
-- insert into public.projects (title, client, type, stage, progress, start_date, end_date, img, priority, value, valor_sistema, valor_mo, valor_a_receber, notes)
-- values
--   ('Sistema Fotovoltaico Residencial', 'Família Oliveira', 'Instalação fotovoltaica', 'Orçamento', 15, '2024-08-18', '2024-09-30', 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=120&h=80&fit=crop&auto=format', 'Alta', 42000, 42000, 12600, 29400, 'Cliente aguardando proposta detalhada.'),
--   ('Carregador de Carro Elétrico', 'Empresa XYZ', 'Carregador de carro elétrico', 'Aprovado', 35, '2024-08-15', '2024-09-10', 'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=120&h=80&fit=crop&auto=format', 'Média', 18500, 18500, 5550, 12950, 'Aguardando entrega dos equipamentos.');
