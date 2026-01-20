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

    // Get transaction from database
    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("transaction_id", transactionId)
      .maybeSingle();

    if (txError || !transaction) {
      return new Response(
        JSON.stringify({ error: "Transaction not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get payment settings
    const { data: settings } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["cashify_api_key", "cashify_qris_id", "payment_mode"]);

    const settingsMap = Object.fromEntries(
      (settings || []).map((s: { key: string; value: string }) => [s.key, s.value])
    );

    const paymentMode = settingsMap.payment_mode || "demo";

    // If already paid, return success
    if (transaction.status === "paid") {
      return new Response(
        JSON.stringify({
          success: true,
          paid: true,
          transaction,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if expired
    if (transaction.expires_at && new Date(transaction.expires_at) < new Date()) {
      // Update status to expired
      await supabase
        .from("transactions")
        .update({ status: "expired" })
        .eq("transaction_id", transactionId);

      return new Response(
        JSON.stringify({
          success: false,
          paid: false,
          expired: true,
          message: "Transaction has expired",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // In live mode, check with Cashify API
    if (paymentMode === "live" && settingsMap.cashify_api_key && settingsMap.cashify_qris_id) {
      try {
        const cashifyResponse = await fetch(
          `https://gateway.okeconnect.com/api/mutasi/qris/${settingsMap.cashify_qris_id}/${settingsMap.cashify_api_key}`,
          { method: "GET" }
        );

        const cashifyData = await cashifyResponse.json();
        
        // Check if transaction is found in mutations
        if (cashifyData.data && Array.isArray(cashifyData.data)) {
          const found = cashifyData.data.find(
            (m: { amount: number; ref?: string }) =>
              m.amount === transaction.total_amount ||
              m.ref === transactionId
          );

          if (found) {
            // Update transaction status
            await supabase
              .from("transactions")
              .update({ 
                status: "paid", 
                paid_at: new Date().toISOString() 
              })
              .eq("transaction_id", transactionId);

            // Send Discord webhook notification
            await sendDiscordNotification(supabase, transaction);

            return new Response(
              JSON.stringify({
                success: true,
                paid: true,
                transaction: { ...transaction, status: "paid" },
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      } catch (cashifyError) {
        console.error("Cashify check error:", cashifyError);
      }
    }

    // Demo mode - auto-complete after checking
    if (paymentMode === "demo") {
      const createdAt = new Date(transaction.created_at).getTime();
      const now = Date.now();
      const elapsedSeconds = (now - createdAt) / 1000;

      // Auto-complete after 5 seconds in demo mode
      if (elapsedSeconds > 5) {
        await supabase
          .from("transactions")
          .update({ 
            status: "paid", 
            paid_at: new Date().toISOString() 
          })
          .eq("transaction_id", transactionId);

        return new Response(
          JSON.stringify({
            success: true,
            paid: true,
            transaction: { ...transaction, status: "paid" },
            mode: "demo",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        paid: false,
        transaction,
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

async function sendDiscordNotification(supabase: any, transaction: any) {
  try {
    const { data: webhookSetting } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "discord_webhook_url")
      .maybeSingle();

    if (webhookSetting?.value) {
      const embed = {
        title: "💰 Pembayaran Berhasil!",
        color: 0x00ff00,
        fields: [
          { name: "Transaction ID", value: transaction.transaction_id, inline: true },
          { name: "Customer", value: transaction.customer_name, inline: true },
          { name: "Package", value: `${transaction.package_name} (${transaction.package_duration} hari)`, inline: true },
          { name: "Amount", value: `Rp ${transaction.total_amount.toLocaleString("id-ID")}`, inline: true },
          { name: "License Key", value: transaction.license_key || "-", inline: false },
        ],
        timestamp: new Date().toISOString(),
      };

      await fetch(webhookSetting.value, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [embed] }),
      });
    }
  } catch (error) {
    console.error("Discord webhook error:", error);
  }
}
