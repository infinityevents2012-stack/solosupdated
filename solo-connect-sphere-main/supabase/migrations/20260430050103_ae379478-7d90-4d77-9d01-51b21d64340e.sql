-- 1) read receipts
alter table public.messages
  add column if not exists read_at timestamptz;

-- Allow recipients to mark messages as read
drop policy if exists "msg_update_recipient_read" on public.messages;
create policy "msg_update_recipient_read"
on public.messages
for update
using (
  exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
      and messages.sender_id <> auth.uid()
  )
)
with check (
  exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
      and messages.sender_id <> auth.uid()
  )
);

-- 2) blocks table
create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null,
  blocked_id uuid not null,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id)
);

alter table public.blocks enable row level security;

drop policy if exists "blocks_select_self" on public.blocks;
create policy "blocks_select_self"
on public.blocks for select
using (auth.uid() = blocker_id or auth.uid() = blocked_id);

drop policy if exists "blocks_insert_self" on public.blocks;
create policy "blocks_insert_self"
on public.blocks for insert
with check (auth.uid() = blocker_id);

drop policy if exists "blocks_delete_self" on public.blocks;
create policy "blocks_delete_self"
on public.blocks for delete
using (auth.uid() = blocker_id);

create index if not exists blocks_blocker_idx on public.blocks(blocker_id);
create index if not exists blocks_blocked_idx on public.blocks(blocked_id);

-- Helper: is there a block in either direction between two users?
create or replace function public.is_blocked_between(_a uuid, _b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = _a and blocked_id = _b)
       or (blocker_id = _b and blocked_id = _a)
  )
$$;

-- 3) Update message visibility to hide blocked DMs
drop policy if exists "msg_select_participant" on public.messages;
create policy "msg_select_participant"
on public.messages for select
using (
  exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
      and not public.is_blocked_between(c.user_a, c.user_b)
  )
);

drop policy if exists "msg_insert_sender" on public.messages;
create policy "msg_insert_sender"
on public.messages for insert
with check (
  auth.uid() = sender_id
  and exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
      and not public.is_blocked_between(c.user_a, c.user_b)
  )
);

-- 4) calls table
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  caller_id uuid not null,
  callee_id uuid not null,
  mode text not null check (mode in ('voice','video')),
  status text not null default 'ringing' check (status in ('ringing','accepted','declined','ended','missed')),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

alter table public.calls enable row level security;

drop policy if exists "calls_select_participant" on public.calls;
create policy "calls_select_participant"
on public.calls for select
using (auth.uid() = caller_id or auth.uid() = callee_id);

drop policy if exists "calls_insert_caller" on public.calls;
create policy "calls_insert_caller"
on public.calls for insert
with check (auth.uid() = caller_id);

drop policy if exists "calls_update_participant" on public.calls;
create policy "calls_update_participant"
on public.calls for update
using (auth.uid() = caller_id or auth.uid() = callee_id)
with check (auth.uid() = caller_id or auth.uid() = callee_id);

create index if not exists calls_conv_idx on public.calls(conversation_id);
create index if not exists calls_callee_idx on public.calls(callee_id);

-- Realtime
alter publication supabase_realtime add table public.calls;