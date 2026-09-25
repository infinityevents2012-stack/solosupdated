
-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  avatar_url text,
  is_premium boolean not null default false,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_all" on public.profiles for select using (true);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Conversations (DM between two users)
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_a, user_b)
);
alter table public.conversations enable row level security;
create policy "conv_select_participant" on public.conversations for select
  using (auth.uid() = user_a or auth.uid() = user_b);
create policy "conv_insert_participant" on public.conversations for insert
  with check (auth.uid() = user_a or auth.uid() = user_b);

-- Messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text,
  image_url text,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;

create or replace function public.is_conversation_participant(_conv uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversations
    where id = _conv and (user_a = _user or user_b = _user)
  )
$$;

create policy "msg_select_participant" on public.messages for select
  using (public.is_conversation_participant(conversation_id, auth.uid()));
create policy "msg_insert_sender" on public.messages for insert
  with check (auth.uid() = sender_id and public.is_conversation_participant(conversation_id, auth.uid()));

-- Realtime
alter table public.messages replica identity full;
alter publication supabase_realtime add table public.messages;
alter table public.profiles replica identity full;
alter publication supabase_realtime add table public.profiles;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 6)),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Storage bucket for DM images
insert into storage.buckets (id, name, public) values ('dm-images', 'dm-images', true)
on conflict (id) do nothing;

create policy "dm_images_public_read" on storage.objects for select
  using (bucket_id = 'dm-images');
create policy "dm_images_auth_upload" on storage.objects for insert
  with check (bucket_id = 'dm-images' and auth.role() = 'authenticated');
