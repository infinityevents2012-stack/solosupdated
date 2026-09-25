import { supabase } from "@/integrations/supabase/client";

export type DBComment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
};

export type CommentWithAuthor = DBComment & {
  author: {
    id: string;
    username: string | null;
    avatar_url: string | null;
  } | null;
};

export type CommentNode = CommentWithAuthor & { replies: CommentNode[] };

export type DBPost = {
  id: string;
  author_id: string;
  image_url: string | null;
  caption: string | null;
  location: string | null;
  created_at: string;
  external_slug: string | null;
};

export type PostWithAuthor = DBPost & {
  author: {
    id: string;
    username: string | null;
    avatar_url: string | null;
  } | null;
};

export async function getPostById(id: string): Promise<PostWithAuthor | null> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const { data: author } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .eq("id", data.author_id)
    .maybeSingle();
  return { ...(data as DBPost), author: (author as PostWithAuthor["author"]) ?? null };
}

export async function getOrCreateMockPost(slug: string): Promise<PostWithAuthor | null> {
  // Look up existing
  const { data: existing } = await supabase
    .from("posts")
    .select("*")
    .eq("external_slug", slug)
    .maybeSingle();
  if (existing) {
    const { data: author } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .eq("id", (existing as DBPost).author_id)
      .maybeSingle();
    return {
      ...(existing as DBPost),
      author: (author as PostWithAuthor["author"]) ?? null,
    };
  }

  // Create on demand under the current user (mock posts have no real author).
  const { data: userResp } = await supabase.auth.getUser();
  const uid = userResp.user?.id;
  if (!uid) return null;

  const { data: created, error } = await supabase
    .from("posts")
    .insert({
      author_id: uid,
      external_slug: slug,
      caption: null,
      image_url: null,
    })
    .select("*")
    .single();
  if (error || !created) return null;

  const { data: author } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .eq("id", uid)
    .maybeSingle();
  return {
    ...(created as DBPost),
    author: (author as PostWithAuthor["author"]) ?? null,
  };
}

export async function listComments(postId: string): Promise<CommentNode[]> {
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  const userIds = Array.from(new Set(data.map((c) => c.user_id)));
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
  const profMap = new Map(
    (profs ?? []).map((p) => [p.id, p as CommentWithAuthor["author"]])
  );

  const enriched: CommentWithAuthor[] = (data as DBComment[]).map((c) => ({
    ...c,
    author: profMap.get(c.user_id) ?? null,
  }));

  return buildTree(enriched);
}

function buildTree(rows: CommentWithAuthor[]): CommentNode[] {
  const byId = new Map<string, CommentNode>();
  rows.forEach((r) => byId.set(r.id, { ...r, replies: [] }));
  const roots: CommentNode[] = [];
  // Newest first for roots; replies sorted oldest -> newest for natural reading.
  rows.forEach((r) => {
    const node = byId.get(r.id)!;
    if (r.parent_id && byId.has(r.parent_id)) {
      byId.get(r.parent_id)!.replies.push(node);
    } else {
      roots.push(node);
    }
  });
  // Sort replies oldest first
  byId.forEach((n) => {
    n.replies.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  });
  return roots;
}

export async function addComment(
  postId: string,
  content: string,
  parentId: string | null
): Promise<DBComment | null> {
  const { data: userResp } = await supabase.auth.getUser();
  const uid = userResp.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from("comments")
    .insert({
      post_id: postId,
      user_id: uid,
      parent_id: parentId,
      content: content.trim(),
    })
    .select("*")
    .single();
  if (error) return null;
  return data as DBComment;
}

export async function deleteComment(id: string): Promise<boolean> {
  const { error } = await supabase.from("comments").delete().eq("id", id);
  return !error;
}

export function subscribeComments(postId: string, onChange: () => void) {
  const channel = supabase
    .channel(`comments:${postId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "comments",
        filter: `post_id=eq.${postId}`,
      },
      () => onChange()
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
