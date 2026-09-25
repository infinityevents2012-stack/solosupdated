import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = Deno.env.get("METERED_TURN_URL");
  const username = Deno.env.get("METERED_TURN_USERNAME");
  const credential = Deno.env.get("METERED_TURN_CREDENTIAL");

  const iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  if (url && username && credential) {
    iceServers.push(
      { urls: `turn:${url}:80?transport=udp`, username, credential } as any,
      { urls: `turn:${url}:80?transport=tcp`, username, credential } as any,
      { urls: `turns:${url}:443?transport=tcp`, username, credential } as any,
    );
  }

  return new Response(JSON.stringify({ iceServers }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
