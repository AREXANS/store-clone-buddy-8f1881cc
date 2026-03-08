import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { transactionId } = await req.json();

    if (!transactionId) {
      return new Response(JSON.stringify({ error: "Transaction ID required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: settings } = await supabase
      .from("site_settings").select("key, value")
      .in("key", ["pakasir_slug", "pakasir_api_key", "pakasir_mode"]);

    const s = Object.fromEntries((settings || []).map((r: any) => [r.key, r.value]));

    // Cancel in Pakasir if live mode
    if (s.pakasir_mode === "live" && s.pakasir_slug && s.pakasir_api_key) {
      try {
        await fetch("https://app.pakasir.com/api/transactioncancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project: s.pakasir_slug,
            order_id: transactionId,
            amount: 0,
            api_key: s.pakasir_api_key,
          }),
        });
      } catch (err) {
        console.error("Pakasir cancel error:", err);
      }
    }

    await supabase.from("transactions").update({ status: "cancelled" }).eq("transaction_id", transactionId);

    return new Response(JSON.stringify({ success: true, message: "Transaction cancelled" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: unknown) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
