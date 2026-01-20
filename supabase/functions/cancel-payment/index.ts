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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { transactionId } = body;

    if (!transactionId) {
      return new Response(
        JSON.stringify({ error: "Transaction ID required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get payment settings
    const { data: settings } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["cashify_license_key", "payment_mode"]);

    const settingsMap = Object.fromEntries(
      (settings || []).map((s: { key: string; value: string }) => [s.key, s.value])
    );

    const paymentMode = settingsMap.payment_mode || "demo";
    const licenseKey = settingsMap.cashify_license_key || "";

    // Cancel in Cashify if live mode
    if (paymentMode === "live" && licenseKey) {
      try {
        const cashifyResponse = await fetch("https://cashify.my.id/api/generate/cancel-status", {
          method: "POST",
          headers: {
            "x-license-key": licenseKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transactionId: transactionId,
          }),
        });

        const cashifyData = await cashifyResponse.json();
        console.log("Cashify cancel response:", cashifyData);
      } catch (error) {
        console.error("Cashify cancel error:", error);
      }
    }

    // Update local database
    const { error: updateError } = await supabase
      .from("transactions")
      .update({ status: "cancelled" })
      .eq("transaction_id", transactionId);

    if (updateError) {
      console.error("Update error:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Transaction cancelled",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
