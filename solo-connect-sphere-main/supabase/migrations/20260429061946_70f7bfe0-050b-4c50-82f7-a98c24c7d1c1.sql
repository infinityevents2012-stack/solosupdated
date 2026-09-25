
drop policy if exists "msg_select_participant" on public.messages;
drop policy if exists "msg_insert_sender" on public.messages;

create policy "msg_select_participant" on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );

create policy "msg_insert_sender" on public.messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );

drop function if exists public.is_conversation_participant(uuid, uuid);
