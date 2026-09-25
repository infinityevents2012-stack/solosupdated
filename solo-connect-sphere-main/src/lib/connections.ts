import { supabase } from "@/integrations/supabase/client";

export interface DBConnectionRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  created_at: string;
  updated_at: string;
}

export async function sendConnectionRequest(senderId: string, receiverId: string) {
  const { data, error } = await supabase
    .from("connection_requests")
    .upsert(
      { sender_id: senderId, receiver_id: receiverId, status: "pending" },
      { onConflict: "sender_id,receiver_id" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as DBConnectionRequest;
}

export async function cancelConnectionRequest(senderId: string, receiverId: string) {
  const { error } = await supabase
    .from("connection_requests")
    .delete()
    .eq("sender_id", senderId)
    .eq("receiver_id", receiverId);
  if (error) throw error;
}

export async function getConnectionStatus(
  myUid: string,
  peerId: string
): Promise<{ status: "none" | "pending" | "accepted" | "rejected" | "cancelled"; iSent: boolean }> {
  const { data } = await supabase
    .from("connection_requests")
    .select("*")
    .or(
      `and(sender_id.eq.${myUid},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${myUid})`
    )
    .limit(1);
  const row = data?.[0] as DBConnectionRequest | undefined;
  if (!row) return { status: "none", iSent: false };
  return { status: row.status, iSent: row.sender_id === myUid };
}

export async function respondToConnectionRequest(
  requestId: string,
  status: "accepted" | "rejected"
) {
  const { error } = await supabase
    .from("connection_requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) throw error;
}

export async function listIncomingPendingRequests(myUid: string) {
  const { data } = await supabase
    .from("connection_requests")
    .select("*")
    .eq("receiver_id", myUid)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return (data ?? []) as DBConnectionRequest[];
}

export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .limit(1);
  return !data || data.length === 0;
}
