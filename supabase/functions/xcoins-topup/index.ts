import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { userId, amount } = await req.json();

    if (!userId || !amount || amount < 1000) {
      return new Response(JSON.stringify({ error: "Minimal top-up Rp 1.000" }), 
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get payment settings
    const { data: settings } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["cashify_license_key", "cashify_qris_id", "payment_mode"]);

    const settingsMap = Object.fromEntries((settings || []).map((s: any) => [s.key, s.value]));
    const paymentMode = settingsMap.payment_mode || "demo";
    const licenseKey = settingsMap.cashify_license_key || "";
    const qrisId = settingsMap.cashify_qris_id || "";

    const transactionId = `TOPUP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    let qrString = "";
    let qrisUrl = "";
    let totalAmount = amount;
    let cashifyTransactionId = "";

    if (paymentMode === "live" && licenseKey && qrisId) {
      const cashifyResponse = await fetch("https://cashify.my.id/api/generate/v2/qris", {
        method: "POST",
        headers: { "x-license-key": licenseKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          qr_id: qrisId, amount, useUniqueCode: true,
          packageIds: ["id.dana"], expiredInMinutes: 15,
          qrType: "dynamic", paymentMethod: "qris", useQris: true,
        }),
      });

      const cashifyData = await cashifyResponse.json();
      if (cashifyData.status === 200 && cashifyData.data) {
        qrString = cashifyData.data.qr_string || "";
        cashifyTransactionId = cashifyData.data.transactionId || "";
        totalAmount = cashifyData.data.totalAmount || amount;
        qrisUrl = `https://larabert-qrgen.hf.space/v1/create-qr-code?size=500x500&style=2&color=0D8BA5&data=${encodeURIComponent(qrString)}`;
      } else {
        return new Response(JSON.stringify({ error: cashifyData.message || "Gagal generate QRIS" }), 
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else {
      qrString = `DEMO-${transactionId}`;
      qrisUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=DEMO-${transactionId}`;
      cashifyTransactionId = transactionId;
    }

    // Save as transaction in transactions table for tracking
    await supabase.from("transactions").insert({
      transaction_id: cashifyTransactionId || transactionId,
      customer_name: `TOPUP-${userId.slice(0, 8)}`,
      package_name: "XCOINS_TOPUP",
      package_duration: 0,
      original_amount: amount,
      total_amount: totalAmount,
      status: "pending",
      qr_string: qrString,
      license_key: userId,
      expires_at: expiresAt.toISOString(),
    });

    return new Response(JSON.stringify({
      success: true,
      transactionId: cashifyTransactionId || transactionId,
      qr_string: qrString,
      qris_url: qrisUrl,
      totalAmount,
      expiresAt: expiresAt.toISOString(),
      mode: paymentMode,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: unknown) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
