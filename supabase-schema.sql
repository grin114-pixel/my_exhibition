create extension if not exists pgcrypto;

create table if not exists public.exhibitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  place text not null default '',
  link text not null default '',
  memo text not null default '',
  expires_at date not null,
  is_recurring boolean not null default false,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.exhibitions
  add column if not exists link text not null default '';

alter table public.exhibitions
  add column if not exists memo text not null default '';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists exhibitions_set_updated_at on public.exhibitions;
create trigger exhibitions_set_updated_at
before update on public.exhibitions
for each row
execute function public.set_updated_at();

alter table public.exhibitions enable row level security;

drop policy if exists "public exhibition select" on public.exhibitions;
create policy "public exhibition select"
on public.exhibitions
for select
to public
using (true);

drop policy if exists "public exhibition insert" on public.exhibitions;
create policy "public exhibition insert"
on public.exhibitions
for insert
to public
with check (true);

drop policy if exists "public exhibition update" on public.exhibitions;
create policy "public exhibition update"
on public.exhibitions
for update
to public
using (true)
with check (true);

drop policy if exists "public exhibition delete" on public.exhibitions;
create policy "public exhibition delete"
on public.exhibitions
for delete
to public
using (true);

insert into storage.buckets (id, name, public)
values ('exhibition-images', 'exhibition-images', true)
on conflict (id) do nothing;

drop policy if exists "public storage select" on storage.objects;
create policy "public storage select"
on storage.objects
for select
to public
using (bucket_id = 'exhibition-images');

drop policy if exists "public storage insert" on storage.objects;
create policy "public storage insert"
on storage.objects
for insert
to public
with check (bucket_id = 'exhibition-images');

drop policy if exists "public storage update" on storage.objects;
create policy "public storage update"
on storage.objects
for update
to public
using (bucket_id = 'exhibition-images')
with check (bucket_id = 'exhibition-images');

drop policy if exists "public storage delete" on storage.objects;
create policy "public storage delete"
on storage.objects
for delete
to public
using (bucket_id = 'exhibition-images');
