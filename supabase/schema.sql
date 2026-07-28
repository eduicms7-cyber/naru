-- Naru: Supabase schema for cross-device sync.
-- Run this once in the Supabase dashboard's SQL Editor (Project > SQL Editor > New query).

create table if not exists todos (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  created_at bigint not null
);

create table if not exists memos (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text text not null default '',
  image_uri text,
  created_at bigint not null,
  review_stage int not null default 0,
  next_review_at bigint not null,
  last_reviewed_at bigint,
  is_priority boolean not null default false
);

create table if not exists schedules (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date text not null,
  title text not null,
  created_at bigint not null
);

alter table todos enable row level security;
alter table memos enable row level security;
alter table schedules enable row level security;

create policy "todos_owner_all" on todos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "memos_owner_all" on memos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "schedules_owner_all" on schedules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Storage bucket for memo images (public read so <Image> can load the URL directly,
-- write restricted to the authenticated owner via the policies below).
insert into storage.buckets (id, name, public)
values ('memo-images', 'memo-images', true)
on conflict (id) do nothing;

create policy "memo_images_public_read" on storage.objects
  for select using (bucket_id = 'memo-images');

create policy "memo_images_owner_write" on storage.objects
  for insert with check (bucket_id = 'memo-images' and owner = auth.uid());

create policy "memo_images_owner_delete" on storage.objects
  for delete using (bucket_id = 'memo-images' and owner = auth.uid());
