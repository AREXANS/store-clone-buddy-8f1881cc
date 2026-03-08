import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const scriptName = url.searchParams.get("name");
    const token = url.searchParams.get("token");

    // Secret token untuk akses script - hanya executor yang tahu token ini
    const SCRIPT_ACCESS_TOKEN = "AXS-SECURE-2026-RBLX";

    if (!scriptName) {
      return new Response("-- Access Denied: Invalid request", {
        status: 403, headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    // Validasi token - tanpa token yang benar, akses ditolak
    if (token !== SCRIPT_ACCESS_TOKEN) {
      return new Response("-- [Arexans] Access Denied. This script is protected.\n-- Unauthorized access is not permitted.\n-- If you believe this is an error, contact the administrator.", {
        status: 403, headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: script, error } = await supabase
      .from("lua_scripts")
      .select("content, is_active")
      .eq("name", scriptName)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !script) {
      return new Response("-- [Arexans] Access Denied.", {
        status: 403, headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    return new Response(script.content, {
      status: 200,
      headers: { 
        ...corsHeaders, 
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate"
      },
    });
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(`-- Error: ${errorMessage}`, {
      status: 500, headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }
});