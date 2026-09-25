-- Posts table
CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  image_url text,
  caption text,
  location text,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- For seeding/linking mock content, allow a stable external slug
  external_slug text UNIQUE
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "posts_select_all" ON public.posts
  FOR SELECT USING (true);

CREATE POLICY "posts_insert_own" ON public.posts
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "posts_update_own" ON public.posts
  FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "posts_delete_own" ON public.posts
  FOR DELETE USING (auth.uid() = author_id);

CREATE INDEX idx_posts_created_at ON public.posts (created_at DESC);
CREATE INDEX idx_posts_author ON public.posts (author_id);

-- Comments table (with nested replies via parent_id)
CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL CHECK (length(content) > 0 AND length(content) <= 2000),
  parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_select_authenticated" ON public.comments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "comments_insert_own" ON public.comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "comments_delete_own" ON public.comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_comments_post_id ON public.comments (post_id, created_at DESC);
CREATE INDEX idx_comments_parent_id ON public.comments (parent_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER TABLE public.comments REPLICA IDENTITY FULL;