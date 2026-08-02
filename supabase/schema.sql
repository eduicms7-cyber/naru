-- Naru: Supabase schema for cross-device sync.
-- Run this once in the Supabase dashboard's SQL Editor (Project > SQL Editor > New query).

create table if not exists todos (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  created_at bigint not null,
  completed_at bigint,
  tags text[] not null default '{}'
);

create table if not exists memos (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text text not null default '',
  image_uri text,
  image_uris text[] not null default '{}',
  created_at bigint not null,
  review_stage int not null default 0,
  next_review_at bigint not null,
  last_reviewed_at bigint,
  is_pinned boolean not null default false,
  tags text[] not null default '{}',
  color text,
  note_type text not null default 'text',
  checklist_items jsonb not null default '[]'
);

-- 기존에 이미 schema.sql을 실행해 memos 테이블이 있는 프로젝트는 아래 마이그레이션을
-- Supabase SQL Editor에서 한 번 더 실행해야 한다 (지식창고 기능: 고정/태그/색상/체크리스트).
-- alter table memos rename column is_priority to is_pinned;
-- alter table memos add column if not exists tags text[] not null default '{}';
-- alter table memos add column if not exists color text;
-- alter table memos add column if not exists note_type text not null default 'text';
-- alter table memos add column if not exists checklist_items jsonb not null default '[]';
-- alter table todos add column if not exists completed_at bigint;
-- alter table todos add column if not exists tags text[] not null default '{}';

-- 카드 하나당 이미지 여러 장 첨부 기능: 기존 memos 테이블에 image_uris 배열 컬럼을 추가하고,
-- 이미 있던 단일 이미지(image_uri) 값을 배열의 첫 원소로 옮긴다. image_uri 컬럼은 당분간
-- 그대로 남겨둔다(하위호환용 병행 기록).
-- alter table memos add column if not exists image_uris text[] not null default '{}';
-- update memos set image_uris = array[image_uri]
--   where image_uri is not null and (image_uris is null or array_length(image_uris, 1) is null);

create table if not exists schedules (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date text not null,
  title text not null,
  created_at bigint not null
);

create table if not exists favorites (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  url text not null,
  position int not null default 0,
  created_at bigint not null
);

alter table todos enable row level security;
alter table memos enable row level security;
alter table schedules enable row level security;
alter table favorites enable row level security;

create policy "todos_owner_all" on todos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "memos_owner_all" on memos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "schedules_owner_all" on schedules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "favorites_owner_all" on favorites
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
