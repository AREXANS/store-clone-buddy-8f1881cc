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

    const { data: transaction } = await supabase
      .from("transactions").select("*").eq("transaction_id", transactionId).maybeSingle();

    if (!transaction) {
      return new Response(JSON.stringify({ error: "Transaction not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Already paid
    if (transaction.status === "paid") {
      return new Response(JSON.stringify({ success: true, paid: true, transaction }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Expired
    if (transaction.expires_at && new Date(transaction.expires_at) < new Date()) {
      await supabase.from("transactions").update({ status: "expired" }).eq("transaction_id", transactionId);
      return new Response(JSON.stringify({ success: false, paid: false, expired: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: settings } = await supabase
      .from("site_settings").select("key, value")
      .in("key", ["pakasir_slug", "pakasir_api_key", "pakasir_mode", "payment_simulation", "discord_webhook_url"]);

    const s = Object.fromEntries((settings || []).map((r: any) => [r.key, r.value]));
    const pakasirMode = s.pakasir_mode || "sandbox";
    const simulation = s.payment_simulation || "off";

    let isPaid = false;

    // Live mode: check Pakasir API
    if (pakasirMode === "live" && s.pakasir_slug && s.pakasir_api_key) {
      try {
        const url = `https://app.pakasir.com/api/transactiondetail?project=${s.pakasir_slug}&amount=${transaction.total_amount}&order_id=${transactionId}&api_key=${s.pakasir_api_key}`;
        const res = await fetch(url);
        const data = await res.json();
        console.log("Pakasir check:", JSON.stringify(data));
        if (data.transaction?.status === "completed") {
          isPaid = true;
        }
      } catch (err) {
        console.error("Pakasir check error:", err);
      }
    }

    // Simulation mode
    if (simulation === "on") {
      isPaid = true;
    }

    // Demo/sandbox mode - auto after 5s
    if (pakasirMode === "sandbox" || pakasirMode === "demo") {
      const elapsed = Date.now() - new Date(transaction.created_at).getTime();
      if (elapsed > 5000) isPaid = true;
    }

    if (isPaid) {
      await supabase.from("transactions").update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("transaction_id", transactionId);

      // Create license key
      await createLicenseKey(transaction);

      // Discord notification
      if (s.discord_webhook_url) {
        await sendDiscordNotification(transaction, s.discord_webhook_url);
      }

      return new Response(JSON.stringify({ success: true, paid: true, transaction: { ...transaction, status: "paid" } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, paid: false, transaction }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: unknown) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

async function createLicenseKey(transaction: any) {
  try {
    if (!transaction.license_key) return;
    const createKeyApiUrl = Deno.env.get("SUPABASE_URL") + "/functions/v1/create-key";
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + (transaction.package_duration || 30));

    const response = await fetch(createKeyApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: transaction.license_key, role: transaction.package_name || "NORMAL", expired: expiryDate.toISOString(), max_hwid: 1 }),
    });
    const result = await response.json();
    console.log("Create key result:", result);
  } catch (error) {
    console.error("Create key error:", error);
  }
}

async function sendDiscordNotification(transaction: any, webhookUrl: string) {
  try {
    const embed = {
      title: "💰 Pembayaran Berhasil!",
      color: 0x00ff00,
      fields: [
        { name: "Transaction ID", value: transaction.transaction_id, inline: true },
        { name: "Customer", value: transaction.customer_name, inline: true },
        { name: "Package", value: `${transaction.package_name} (${transaction.package_duration} hari)`, inline: true },
        { name: "Amount", value: `Rp ${transaction.total_amount?.toLocaleString("id-ID") || 0}`, inline: true },
        { name: "License Key", value: transaction.license_key || "-", inline: false },
      ],
      timestamp: new Date().toISOString(),
    };
    await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ embeds: [embed] }) });
  } catch (error) {
    console.error("Discord webhook error:", error);
  }
}
