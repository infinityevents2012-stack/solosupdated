
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS quoted_message_id uuid;

CREATE INDEX IF NOT EXISTS idx_messages_quoted_message_id ON public.messages(quoted_message_id);
