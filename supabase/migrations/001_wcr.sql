-- Execute uma vez no SQL Editor de um projeto Supabase novo.
begin;

create table public.wcr_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.wcr_members enable row level security;
create policy "Consultar o próprio acesso" on public.wcr_members for select to authenticated using (user_id = auth.uid());

create function public.is_wcr_member() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.wcr_members where user_id = auth.uid());
$$;
revoke all on function public.is_wcr_member() from public;
grant execute on function public.is_wcr_member() to authenticated;

create table public.people (
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
  name text not null check(length(trim(name)) > 0), cpf text unique check(cpf ~ '^\d{11}$'),
  phone text not null default '', email text not null default '',
  category text not null default 'Candidato' check(category in ('Candidato','Funcionário')),
  notes text not null default '', boot_size text not null default '', shirt_size text not null default '',
  pants_size text not null default '', transport text not null default ''
);
create table public.contracts (
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
  name text not null check(length(trim(name)) > 0), client text not null check(length(trim(client)) > 0),
  location text not null default '', notes text not null default '', active boolean not null default true
);
create table public.roles (
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
  contract_id uuid not null references public.contracts(id), name text not null check(length(trim(name)) > 0),
  unique(contract_id, name)
);
create table public.teams (
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
  contract_id uuid not null references public.contracts(id), name text not null check(length(trim(name)) > 0),
  unique(contract_id, name)
);
create table public.slots (
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
  team_id uuid not null references public.teams(id), role_id uuid not null references public.roles(id),
  target integer not null default 1 check(target >= 0), unique(team_id, role_id)
);
create table public.assignments (
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
  person_id uuid not null references public.people(id), contract_id uuid not null references public.contracts(id),
  role_id uuid references public.roles(id), employment text not null check(employment in ('CLT','PJ','Estágio')),
  status text not null default 'Pendente' check(status in ('Pendente','Em admissão','Ativo','Removido')),
  start_date date, unique(person_id, contract_id)
);
create table public.memberships (
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
  assignment_id uuid not null references public.assignments(id), team_id uuid not null references public.teams(id),
  unique(assignment_id, team_id)
);
create table public.requirements (
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
  contract_id uuid not null references public.contracts(id), title text not null check(length(trim(title)) > 0),
  instructions text not null default '', kind text not null default 'Documento' check(kind in ('Documento','Tarefa')),
  employment text not null default 'Todos' check(employment in ('Todos','CLT','PJ','Estágio')),
  role_id uuid references public.roles(id), position integer not null default 0,
  active boolean not null default true, conditional boolean not null default false
);
create table public.checks (
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
  assignment_id uuid not null references public.assignments(id), requirement_id uuid not null references public.requirements(id),
  status text not null default 'Pendente' check(status in ('Pendente','Recebido','Enviado ao cliente','Aprovado','Recusado','Não se aplica')),
  notes text not null default '', unique(assignment_id, requirement_id),
  check(status <> 'Recusado' or length(trim(notes)) > 0)
);
create table public.files (
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
  assignment_id uuid not null references public.assignments(id), requirement_id uuid not null references public.requirements(id),
  name text not null, path text not null unique, size bigint not null check(size > 0 and size <= 52428800),
  content_type text not null check(content_type in ('application/pdf','image/jpeg','image/png','image/webp')),
  check(path like assignment_id::text || '/' || requirement_id::text || '/%')
);

-- Relações entre contratos são verificadas também no banco, não apenas na tela.
create function public.validate_contract_relation() returns trigger language plpgsql set search_path = public as $$
declare first_contract uuid; second_contract uuid;
begin
  if tg_table_name in ('assignments','requirements') then
    if new.role_id is null then return new; end if;
    first_contract := new.contract_id;
    select contract_id into second_contract from public.roles where id = new.role_id;
  elsif tg_table_name = 'slots' then
    select contract_id into first_contract from public.teams where id = new.team_id;
    select contract_id into second_contract from public.roles where id = new.role_id;
  elsif tg_table_name = 'memberships' then
    select contract_id into first_contract from public.assignments where id = new.assignment_id;
    select contract_id into second_contract from public.teams where id = new.team_id;
  else
    select contract_id into first_contract from public.assignments where id = new.assignment_id;
    select contract_id into second_contract from public.requirements where id = new.requirement_id;
  end if;
  if first_contract is null or second_contract is null or first_contract <> second_contract then
    raise exception 'Os registros precisam pertencer ao mesmo contrato.';
  end if;
  return new;
end;
$$;

-- A estrutura de parentesco de um registro não muda após sua criação.
create function public.prevent_reparenting() returns trigger language plpgsql as $$
begin
  if tg_table_name in ('roles','teams','requirements','assignments') and new.contract_id <> old.contract_id then
    raise exception 'Crie um novo vínculo para mudar o contrato.';
  end if;
  if tg_table_name = 'assignments' then
    if new.person_id <> old.person_id then raise exception 'A pessoa de um vínculo não pode ser substituída.'; end if;
  end if;
  return new;
end;
$$;

do $$ declare t text; begin
  foreach t in array array['people','contracts','roles','teams','slots','assignments','memberships','requirements','checks','files'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "Equipe interna WCR" on public.%I for all to authenticated using (public.is_wcr_member()) with check (public.is_wcr_member())', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
  foreach t in array array['assignments','requirements','slots','memberships','checks','files'] loop
    execute format('create trigger validate_contract before insert or update on public.%I for each row execute function public.validate_contract_relation()', t);
  end loop;
  foreach t in array array['roles','teams','requirements','assignments'] loop
    execute format('create trigger keep_contract before update on public.%I for each row execute function public.prevent_reparenting()', t);
  end loop;
end $$;
grant select on public.wcr_members to authenticated;
create index on public.assignments(contract_id);
create index on public.requirements(contract_id);
create index on public.checks(assignment_id);
create index on public.files(assignment_id);
create index on public.memberships(team_id);

create function public.create_contract(payload jsonb, items jsonb) returns uuid language plpgsql security invoker set search_path = public as $$
declare contract uuid; item jsonb; pos integer := 0;
begin
  insert into public.contracts(name, client, location, notes) values (payload->>'name', payload->>'client', coalesce(payload->>'location',''), coalesce(payload->>'notes','')) returning id into contract;
  for item in select * from jsonb_array_elements(items) loop
    insert into public.requirements(contract_id,title,instructions,kind,employment,conditional,position)
      values(contract,item->>'title',coalesce(item->>'instructions',''),item->>'kind',item->>'employment',coalesce((item->>'conditional')::boolean,false),pos);
    pos := pos + 1;
  end loop;
  return contract;
end;
$$;

create function public.save_assignment(payload jsonb, team_ids uuid[]) returns uuid language plpgsql security invoker set search_path = public as $$
declare assignment uuid := coalesce((payload->>'id')::uuid,gen_random_uuid()); person uuid := (payload->>'person_id')::uuid;
begin
  if person is null and payload->'new_person' is not null then
    insert into public.people(name,cpf,phone,category) values(payload->'new_person'->>'name',payload->'new_person'->>'cpf',coalesce(payload->'new_person'->>'phone',''),'Funcionário') returning id into person;
  end if;
  insert into public.assignments(id,person_id,contract_id,role_id,employment,status,start_date)
    values(assignment,person,(payload->>'contract_id')::uuid,(payload->>'role_id')::uuid,payload->>'employment',payload->>'status',nullif(payload->>'start_date','')::date)
    on conflict(id) do update set role_id=excluded.role_id,employment=excluded.employment,status=excluded.status,start_date=excluded.start_date;
  delete from public.memberships where assignment_id = assignment;
  insert into public.memberships(assignment_id,team_id) select assignment,unnest(team_ids);
  if nullif(payload->>'role_id','') is not null then
    insert into public.slots(team_id,role_id,target) select unnest(team_ids),(payload->>'role_id')::uuid,0 on conflict(team_id,role_id) do nothing;
  end if;
  update public.people set category='Funcionário' where id=person;
  return assignment;
end;
$$;
revoke all on function public.create_contract(jsonb,jsonb),public.save_assignment(jsonb,uuid[]) from public;
grant execute on function public.create_contract(jsonb,jsonb),public.save_assignment(jsonb,uuid[]) to authenticated;

create function public.save_team(payload jsonb, positions jsonb) returns uuid language plpgsql security invoker set search_path = public as $$
declare team uuid := coalesce((payload->>'id')::uuid,gen_random_uuid()); contract uuid := (payload->>'contract_id')::uuid; position jsonb; role uuid;
begin
  insert into public.teams(id,contract_id,name) values(team,contract,payload->>'name') on conflict(id) do update set name=excluded.name;
  update public.slots set target=0 where team_id=team;
  for position in select * from jsonb_array_elements(positions) loop
    insert into public.roles(contract_id,name) values(contract,trim(position->>'name')) on conflict(contract_id,name) do update set name=excluded.name returning id into role;
    insert into public.slots(team_id,role_id,target) values(team,role,(position->>'target')::integer) on conflict(team_id,role_id) do update set target=excluded.target;
  end loop;
  delete from public.slots s where s.team_id=team and s.target=0
    and not exists(select 1 from public.memberships m join public.assignments a on a.id=m.assignment_id where m.team_id=team and a.role_id=s.role_id);
  return team;
end;
$$;
revoke all on function public.save_team(jsonb,jsonb) from public;
grant execute on function public.save_team(jsonb,jsonb) to authenticated;

-- A importação é uma transação única. Não altera cadastros existentes.
create function public.import_people(entries jsonb, target_contract uuid default null) returns integer language plpgsql security invoker set search_path = public as $$
declare entry jsonb; person uuid; role uuid; team uuid; assignment uuid; req uuid; mark jsonb; imported integer := 0;
begin
  for entry in select * from jsonb_array_elements(entries) loop
    if nullif(entry->>'cpf','') is not null and exists(select 1 from public.people where cpf=entry->>'cpf') then
      raise exception 'CPF já cadastrado. Revise a prévia da importação.';
    end if;
    if nullif(entry->>'cpf','') is null and exists(select 1 from public.people where lower(trim(name))=lower(trim(entry->>'name'))) then
      raise exception 'Nome já cadastrado sem CPF para conferência. Revise a importação.';
    end if;
    insert into public.people(name,cpf,phone,email,category,notes,boot_size,shirt_size,pants_size,transport)
      values(entry->>'name',nullif(entry->>'cpf',''),coalesce(entry->>'phone',''),coalesce(entry->>'email',''),case when target_contract is null then 'Candidato' else 'Funcionário' end,coalesce(entry->>'notes',''),coalesce(entry->>'boot_size',''),coalesce(entry->>'shirt_size',''),coalesce(entry->>'pants_size',''),coalesce(entry->>'transport','')) returning id into person;
    if target_contract is not null then
      role := null;
      if nullif(entry->>'role','') is not null then
        insert into public.roles(contract_id,name) values(target_contract,entry->>'role') on conflict(contract_id,name) do update set name=excluded.name returning id into role;
      end if;
      insert into public.assignments(person_id,contract_id,role_id,employment,status) values(person,target_contract,role,coalesce(entry->>'employment','CLT'),'Pendente') returning id into assignment;
      if nullif(entry->>'team','') is not null then
        insert into public.teams(contract_id,name) values(target_contract,entry->>'team') on conflict(contract_id,name) do update set name=excluded.name returning id into team;
        insert into public.memberships(assignment_id,team_id) values(assignment,team);
        if role is not null then
          insert into public.slots(team_id,role_id,target) values(team,role,0) on conflict(team_id,role_id) do nothing;
        end if;
      end if;
      for mark in select * from jsonb_array_elements(coalesce(entry->'marks','[]'::jsonb)) loop
        select id into req from public.requirements r where r.contract_id=target_contract and r.title=mark->>'title' and r.active
          and (r.employment='Todos' or r.employment=coalesce(entry->>'employment','CLT')) order by r.position limit 1;
        if req is not null then
          insert into public.checks(assignment_id,requirement_id,status,notes) values(assignment,req,mark->>'status','Importado da planilha. Aprovação do cliente não presumida.') on conflict(assignment_id,requirement_id) do nothing;
        end if;
      end loop;
    end if;
    imported := imported + 1;
  end loop;
  return imported;
end;
$$;
revoke all on function public.import_people(jsonb,uuid) from public;
grant execute on function public.import_people(jsonb,uuid) to authenticated;

-- O bucket é privado. Apenas membros cadastrados no SQL Editor têm acesso.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('wcr-documents','wcr-documents',false,52428800,array['application/pdf','image/jpeg','image/png','image/webp']);
create policy "WCR consultar arquivos" on storage.objects for select to authenticated using (bucket_id='wcr-documents' and public.is_wcr_member());
create policy "WCR enviar arquivos" on storage.objects for insert to authenticated with check (
  bucket_id='wcr-documents' and public.is_wcr_member() and exists(
    select 1 from public.assignments a join public.requirements r on r.contract_id=a.contract_id
    where a.id::text=(storage.foldername(name))[1] and r.id::text=(storage.foldername(name))[2]
  )
);
create policy "WCR excluir arquivos" on storage.objects for delete to authenticated using (bucket_id='wcr-documents' and public.is_wcr_member());
commit;
