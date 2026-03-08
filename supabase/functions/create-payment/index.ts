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
      .in("key", ["cashify_license_key", "cashify_qris_id", "payment_mode"]);

    const settingsMap = Object.fromEntries(
      (settings || []).map((s: { key: string; value: string }) => [s.key, s.value])
    );

    const paymentMode = settingsMap.payment_mode || "demo";
    const licenseKey = settingsMap.cashify_license_key || "";
    const qrisId = settingsMap.cashify_qris_id || "";

    const body = await req.json();
    const { 
      amount, 
      customerName, 
      packageName, 
      packageDuration,
      licenseKey: customerLicenseKey,
      promoCode
    } = body;

    if (!amount || amount < 1000) {
      return new Response(
        JSON.stringify({ error: "Amount must be at least 1000" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transactionId = `TRX-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    let qrString = "";
    let qrisUrl = "";
    let totalAmount = amount;
    let cashifyTransactionId = "";

    if (paymentMode === "live" && licenseKey && qrisId) {
      // Call Cashify API v2
      try {
        console.log("Calling Cashify API with:", { qrisId, amount, licenseKey: licenseKey.substring(0, 20) + "..." });
        
        const cashifyResponse = await fetch("https://cashify.my.id/api/generate/v2/qris", {
          method: "POST",
          headers: {
            "x-license-key": licenseKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            qr_id: qrisId,
            amount: amount,
            useUniqueCode: true,
            packageIds: ["id.dana"],
            expiredInMinutes: 15,
            qrType: "dynamic",
            paymentMethod: "qris",
            useQris: true,
          }),
        });

        const cashifyData = await cashifyResponse.json();
        console.log("Cashify response:", JSON.stringify(cashifyData));

        if (cashifyData.status === 200 && cashifyData.data) {
          qrString = cashifyData.data.qr_string || "";
          cashifyTransactionId = cashifyData.data.transactionId || "";
          totalAmount = cashifyData.data.totalAmount || amount;
          
          // Generate stylish QR code URL
          qrisUrl = `https://larabert-qrgen.hf.space/v1/create-qr-code?size=500x500&style=2&color=0D8BA5&data=${encodeURIComponent(qrString)}`;
        } else {
          console.error("Cashify API error:", cashifyData);
          return new Response(
            JSON.stringify({ 
              error: cashifyData.message || "Failed to generate QRIS", 
              details: cashifyData 
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (cashifyError) {
        console.error("Cashify API call failed:", cashifyError);
        return new Response(
          JSON.stringify({ error: "Cashify API connection failed", details: String(cashifyError) }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // Demo mode
      qrString = `DEMO-${transactionId}`;
      qrisUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=DEMO-${transactionId}`;
      cashifyTransactionId = transactionId;
    }

    // Save transaction to database
    const { error: insertError } = await supabase.from("transactions").insert({
      transaction_id: cashifyTransactionId || transactionId,
      customer_name: customerName || "Customer",
      package_name: packageName || "NORMAL",
      package_duration: packageDuration || 1,
      original_amount: amount,
      total_amount: totalAmount,
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
        transactionId: cashifyTransactionId || transactionId,
        qr_string: qrString,
        qris_url: qrisUrl,
        originalAmount: amount,
        totalAmount: totalAmount,
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
