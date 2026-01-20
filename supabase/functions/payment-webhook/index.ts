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
    console.log("Webhook received:", JSON.stringify(body));

    // Get webhook key from settings
    const { data: webhookSetting } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "cashify_webhook_key")
      .maybeSingle();

    const expectedWebhookKey = webhookSetting?.value || "";

    // Validate webhook key if set
    const providedKey = body.webhook_key || body.key || req.headers.get("X-Webhook-Key");
    if (expectedWebhookKey && providedKey !== expectedWebhookKey) {
      console.error("Invalid webhook key");
      return new Response(
        JSON.stringify({ error: "Invalid webhook key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract transaction info from webhook payload
    const transactionId = body.ref || body.transaction_id || body.reference;
    const amount = body.amount || body.total_amount;
    const status = body.status || "paid";

    if (!transactionId && !amount) {
      return new Response(
        JSON.stringify({ error: "Missing transaction identifier" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find and update transaction
    let query = supabase.from("transactions").select("*");
    
    if (transactionId) {
      query = query.eq("transaction_id", transactionId);
    } else if (amount) {
      // Try to find by amount if no transaction ID
      query = query.eq("total_amount", amount).eq("status", "pending");
    }

    const { data: transaction, error: txError } = await query.maybeSingle();

    if (txError || !transaction) {
      console.error("Transaction not found:", { transactionId, amount });
      return new Response(
        JSON.stringify({ error: "Transaction not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update transaction status
    if (status === "paid" || status === "success" || status === "completed") {
      const { error: updateError } = await supabase
        .from("transactions")
        .update({ 
          status: "paid", 
          paid_at: new Date().toISOString() 
        })
        .eq("id", transaction.id);

      if (updateError) {
        console.error("Update error:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update transaction" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Send Discord notification
      await sendDiscordNotification(supabase, transaction);

      console.log("Transaction updated successfully:", transaction.transaction_id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Webhook processed",
        transactionId: transaction.transaction_id 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Webhook error:", error);
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
