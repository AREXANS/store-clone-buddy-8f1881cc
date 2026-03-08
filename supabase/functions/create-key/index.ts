import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { key, role, expired, max_hwid } = await req.json();

    if (!key) {
      return new Response(
        JSON.stringify({ success: false, error: "Key is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "license_keys")
      .maybeSingle();

    let keys = [];
    if (data) {
      try { keys = JSON.parse(data.value || "[]"); } catch { keys = []; }
    }

    if (keys.some((k: any) => k.key === key)) {
      return new Response(
        JSON.stringify({ success: false, error: "Key already exists" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newKey = {
      key,
      expired: expired || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      created: new Date().toISOString(),
      role: role || "VIP",
      maxHwid: max_hwid || 1,
      frozenUntil: null,
      frozenRemainingMs: null,
      hwids: [],
      robloxUsers: []
    };

    keys.push(newKey);

    const { error: updateError } = await supabase
      .from("site_settings")
      .update({ value: JSON.stringify(keys), updated_at: new Date().toISOString() })
      .eq("key", "license_keys");

    if (updateError) {
      return new Response(
        JSON.stringify({ success: false, error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, key: newKey.key, message: "Key created successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});