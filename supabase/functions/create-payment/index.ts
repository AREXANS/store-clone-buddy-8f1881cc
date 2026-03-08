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

    const { data: settings } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["pakasir_slug", "pakasir_api_key", "pakasir_mode", "payment_simulation"]);

    const s = Object.fromEntries((settings || []).map((r: any) => [r.key, r.value]));
    const pakasirMode = s.pakasir_mode || "sandbox";
    const slug = s.pakasir_slug || "";
    const apiKey = s.pakasir_api_key || "";

    const body = await req.json();
    const { amount, customerName, packageName, packageDuration, licenseKey: customerLicenseKey, promoCode, customerWhatsapp } = body;

    if (!amount || amount < 1000) {
      return new Response(JSON.stringify({ error: "Amount must be at least 1000" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const orderId = `TRX-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    let qrString = "";
    let qrisUrl = "";
    let totalAmount = amount;

    if (pakasirMode === "live" && slug && apiKey) {
      // Call Pakasir API to create QRIS transaction
      try {
        const pakasirRes = await fetch("https://app.pakasir.com/api/transactioncreate/qris", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project: slug,
            order_id: orderId,
            amount: amount,
            api_key: apiKey,
          }),
        });

        const pakasirData = await pakasirRes.json();
        console.log("Pakasir response:", JSON.stringify(pakasirData));

        if (pakasirData.payment) {
          qrString = pakasirData.payment.payment_number || "";
          totalAmount = pakasirData.payment.total_payment || amount;
          qrisUrl = `https://larabert-qrgen.hf.space/v1/create-qr-code?size=500x500&style=2&color=0D8BA5&data=${encodeURIComponent(qrString)}`;
        } else {
          return new Response(JSON.stringify({ error: pakasirData.message || pakasirData.error || "Gagal membuat transaksi Pakasir" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } catch (err) {
        console.error("Pakasir API error:", err);
        return new Response(JSON.stringify({ error: "Gagal menghubungi Pakasir" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else {
      // Demo/sandbox mode
      qrString = `DEMO-${orderId}`;
      qrisUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=DEMO-${orderId}`;
    }

    // Save transaction
    await supabase.from("transactions").insert({
      transaction_id: orderId,
      customer_name: customerName || "Customer",
      customer_whatsapp: customerWhatsapp || null,
      package_name: packageName || "NORMAL",
      package_duration: packageDuration || 1,
      original_amount: amount,
      total_amount: totalAmount,
      status: "pending",
      qr_string: qrString,
      license_key: customerLicenseKey || null,
      expires_at: expiresAt.toISOString(),
    });

    return new Response(JSON.stringify({
      success: true,
      transactionId: orderId,
      qr_string: qrString,
      qris_url: qrisUrl,
      originalAmount: amount,
      totalAmount: totalAmount,
      expiresAt: expiresAt.toISOString(),
      mode: pakasirMode,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: unknown) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
