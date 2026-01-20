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

    // Get payment settings from database
    const { data: settings } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["cashify_license_key", "cashify_qris_id", "cashify_api_key", "payment_mode"]);

    const settingsMap = Object.fromEntries(
      (settings || []).map((s: { key: string; value: string }) => [s.key, s.value])
    );

    const paymentMode = settingsMap.payment_mode || "demo";
    const licenseKey = settingsMap.cashify_license_key || "";
    const qrisId = settingsMap.cashify_qris_id || "";
    const apiKey = settingsMap.cashify_api_key || "";

    const body = await req.json();
    const { 
      amount, 
      customerName, 
      customerWhatsapp, 
      packageName, 
      packageDuration,
      licenseKey: customerLicenseKey 
    } = body;

    if (!amount || amount < 1000) {
      return new Response(
        JSON.stringify({ error: "Amount must be at least 1000" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transactionId = `TRX-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    let qrString = "";
    let qrisUrl = "";

    if (paymentMode === "live" && licenseKey && qrisId && apiKey) {
      // Call Cashify API
      try {
        const cashifyResponse = await fetch("https://gateway.okeconnect.com/api/mutasi/qris/v2", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            api: apiKey,
            id: qrisId,
            amount: amount,
            exp: 30, // 30 minutes
            ref: transactionId,
          }),
        });

        const cashifyData = await cashifyResponse.json();

        if (cashifyData.status === "success" || cashifyData.qr_string) {
          qrString = cashifyData.qr_string || cashifyData.data?.qr_string || "";
          qrisUrl = cashifyData.qris_url || cashifyData.data?.qris_url || 
            `https://larabert-qrgen.hf.space/v1/create-qr-code?size=500x500&style=2&color=0D8BA5&data=${encodeURIComponent(qrString)}`;
        } else {
          console.error("Cashify API error:", cashifyData);
          // Fallback to demo mode
          qrString = `DEMO-${transactionId}`;
          qrisUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=DEMO-${transactionId}`;
        }
      } catch (cashifyError) {
        console.error("Cashify API call failed:", cashifyError);
        // Fallback to demo mode
        qrString = `DEMO-${transactionId}`;
        qrisUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=DEMO-${transactionId}`;
      }
    } else {
      // Demo mode
      qrString = `DEMO-${transactionId}`;
      qrisUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=DEMO-${transactionId}`;
    }

    // Save transaction to database
    const { error: insertError } = await supabase.from("transactions").insert({
      transaction_id: transactionId,
      customer_name: customerName || "Customer",
      customer_whatsapp: customerWhatsapp || null,
      package_name: packageName || "NORMAL",
      package_duration: packageDuration || 1,
      original_amount: amount,
      total_amount: amount,
      status: "pending",
      qr_string: qrString,
      license_key: customerLicenseKey || null,
      expires_at: expiresAt.toISOString(),
    });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create transaction" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        transactionId,
        qr_string: qrString,
        qris_url: qrisUrl,
        totalAmount: amount,
        expiresAt: expiresAt.toISOString(),
        mode: paymentMode,
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
