import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "license_keys")
      .maybeSingle();

    if (error) {
      return new Response(
        JSON.stringify({ keys: [], count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let keys = [];
    try {
      keys = JSON.parse(data.value || "[]");
    } catch {
      keys = [];
    }

    // Auto-delete expired keys (not frozen)
    const now = new Date();
    const activeKeys = keys.filter((k: any) => {
      if (k.frozenUntil) return true;
      const expiredDate = new Date(k.expired);
      return expiredDate > now;
    });

    if (activeKeys.length < keys.length) {
      const deletedCount = keys.length - activeKeys.length;
      await supabase
        .from("app_settings")
        .update({ value: JSON.stringify(activeKeys), updated_at: new Date().toISOString() })
        .eq("key", "license_keys");
      
      console.log(`Auto-deleted ${deletedCount} expired keys`);
      keys = activeKeys;
    }

    return new Response(
      JSON.stringify({ keys, count: keys.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage, keys: [], count: 0 }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});