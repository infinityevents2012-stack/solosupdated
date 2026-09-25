import { supabase } from "@/integrations/supabase/client";

export interface DBProfile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  is_premium: boolean;
  last_seen: string;
}

export interface DBMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  read_at: string | null;
  quoted_message_id: string | null;
}

export interface DBConversation {
  id: string;
  user_a: string;
  user_b: string;
  created_at: string;
}

const av = (seed: string) =>
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=000000`;

/** Demo peers seeded for first-time users so DMs are immediately usable. */
const DEMO_PEERS = [
  { username: "aarav_demo", avatar: av("aarav") },
  { username: "priya_demo", avatar: av("priya") },
  { username: "rohan_demo", avatar: av("rohan") },
];

export async function getOrCreateDemoConversations(myUid: string) {
  // Find or create demo peer profiles. These use deterministic UUIDs so the
  // same peer is reused across users.
  const { data: existingPeers } = await supabase
    .from("profiles")
    .select("*")
    .in(
      "username",
      DEMO_PEERS.map((p) => p.username)
    );

  const have = new Set((existingPeers ?? []).map((p) => p.username));
  // We can't create auth users from the client, so any missing demo peers
  // simply won't appear yet. The first user to sign up after a peer is
  // created (e.g. via SQL seed) will see them.

  const peerProfiles = existingPeers ?? [];

  // Ensure a conversation exists with each available peer
  for (const peer of peerProfiles) {
    if (peer.id === myUid) continue;
    const [a, b] = [myUid, peer.id].sort();
    await supabase
      .from("conversations")
      .upsert({ user_a: a, user_b: b }, { onConflict: "user_a,user_b" });
  }
}

export async function listConversations(myUid: string) {
  const { data: convos, error } = await supabase
    .from("conversations")
    .select("*")
    .or(`user_a.eq.${myUid},user_b.eq.${myUid}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!convos?.length) return [];

  const peerIds = convos.map((c) => (c.user_a === myUid ? c.user_b : c.user_a));
  const { data: peers } = await supabase
    .from("profiles")
    .select("*")
    .in("id", peerIds);

  const peerMap = new Map((peers ?? []).map((p) => [p.id, p]));

  // Last message + unread count per conversation
  const { data: lastMsgs } = await supabase
    .from("messages")
    .select("*")
    .in(
      "conversation_id",
      convos.map((c) => c.id)
    )
    .order("created_at", { ascending: false });

  const lastByConv = new Map<string, DBMessage>();
  for (const m of lastMsgs ?? []) {
    if (!lastByConv.has(m.conversation_id))
      lastByConv.set(m.conversation_id, m as DBMessage);
  }

  return convos.map((c) => {
    const peerId = c.user_a === myUid ? c.user_b : c.user_a;
    const peer = peerMap.get(peerId);
    const last = lastByConv.get(c.id);
    return {
      id: c.id,
      peerId,
      peer: (peer as DBProfile | undefined) ?? null,
      lastMessage: last?.content ?? (last?.image_url ? "📷 Photo" : "Say hi 👋"),
      lastAt: last?.created_at ?? c.created_at,
    };
  });
}

export async function getConversation(convId: string, myUid: string) {
  const { data: conv } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", convId)
    .single();
  if (!conv) return null;
  const peerId = conv.user_a === myUid ? conv.user_b : conv.user_a;
  const { data: peer } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", peerId)
    .single();
  return { conv, peer: peer as DBProfile | null };
}

export const PAGE_SIZE = 25;

/** Fetch most recent page of messages, returned in ascending order. */
export async function fetchMessagesPage(
  convId: string,
  beforeIso?: string,
  limit = PAGE_SIZE
): Promise<DBMessage[]> {
  let q = supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (beforeIso) q = q.lt("created_at", beforeIso);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as DBMessage[]).reverse();
}

export async function markConversationRead(convId: string, myUid: string) {
  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", convId)
    .neq("sender_id", myUid)
    .is("read_at", null);
  if (error) console.warn("markConversationRead", error.message);
}

export async function sendTextMessage(
  convId: string,
  senderId: string,
  content: string,
  quotedMessageId?: string | null
) {
  const { error } = await supabase.from("messages").insert({
    conversation_id: convId,
    sender_id: senderId,
    content,
    quoted_message_id: quotedMessageId ?? null,
  });
  if (error) throw error;
}

export async function sendImageMessage(
  convId: string,
  senderId: string,
  file: File,
  quotedMessageId?: string | null
) {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${convId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("dm-images")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from("dm-images").getPublicUrl(path);
  const { error } = await supabase.from("messages").insert({
    conversation_id: convId,
    sender_id: senderId,
    image_url: pub.publicUrl,
    quoted_message_id: quotedMessageId ?? null,
  });
  if (error) throw error;
}

export function subscribeToConversation(
  convId: string,
  onNew: (m: DBMessage) => void,
  onUpdate?: (m: DBMessage) => void
) {
  const channel = supabase
    .channel(`messages:${convId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${convId}`,
      },
      (payload) => onNew(payload.new as DBMessage)
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${convId}`,
      },
      (payload) => onUpdate?.(payload.new as DBMessage)
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/** Lightweight typing / presence channel using Supabase Realtime broadcast. */
export function subscribeTyping(
  convId: string,
  myUid: string,
  onPeerTyping: (typing: boolean) => void
) {
  const channel = supabase.channel(`typing:${convId}`, {
    config: { broadcast: { self: false } },
  });
  channel
    .on("broadcast", { event: "typing" }, (msg) => {
      const p = msg.payload as { uid: string; typing: boolean };
      if (p.uid !== myUid) onPeerTyping(p.typing);
    })
    .subscribe();
  const send = (typing: boolean) => {
    channel.send({
      type: "broadcast",
      event: "typing",
      payload: { uid: myUid, typing },
    });
  };
  return {
    sendTyping: send,
    cleanup: () => {
      supabase.removeChannel(channel);
    },
  };
}

/* ===================== BLOCKS ===================== */

export async function isBlocked(myUid: string, peerId: string) {
  const { data } = await supabase
    .from("blocks")
    .select("id, blocker_id")
    .or(
      `and(blocker_id.eq.${myUid},blocked_id.eq.${peerId}),and(blocker_id.eq.${peerId},blocked_id.eq.${myUid})`
    )
    .limit(1);
  const row = data?.[0];
  return {
    blocked: !!row,
    iBlocked: row?.blocker_id === myUid,
  };
}

export async function blockUser(myUid: string, peerId: string) {
  const { error } = await supabase
    .from("blocks")
    .insert({ blocker_id: myUid, blocked_id: peerId });
  if (error && !error.message.includes("duplicate")) throw error;
}

export async function unblockUser(myUid: string, peerId: string) {
  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", myUid)
    .eq("blocked_id", peerId);
  if (error) throw error;
}

export async function updatePresence() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase
    .from("profiles")
    .update({ last_seen: new Date().toISOString() })
    .eq("id", data.user.id);
}
