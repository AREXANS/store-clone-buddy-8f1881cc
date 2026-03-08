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

    if (!scriptName) {
      return new Response("Missing script name parameter", {
        status: 400, headers: { ...corsHeaders, "Content-Type": "text/plain" },
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
      return new Response(`-- Script "${scriptName}" not found or inactive`, {
        status: 404, headers: { ...corsHeaders, "Content-Type": "text/plain" },
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