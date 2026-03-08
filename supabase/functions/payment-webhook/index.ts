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

    // Detect webhook source: Pakasir sends order_id+project, Cashify sends transactionId
    const isPakasir = !!body.order_id && !!body.project;
    const isCashify = !!body.transactionId && !body.project;

    if (isPakasir) {
      // === PAKASIR WEBHOOK ===
      const transactionId = body.order_id;
      const status = body.status;

      if (status !== "completed") {
        return new Response(JSON.stringify({ success: true, message: "Status not completed" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: transaction } = await supabase
        .from("transactions").select("*").eq("transaction_id", transactionId).maybeSingle();

      if (!transaction) {
        return new Response(JSON.stringify({ error: "Transaction not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (transaction.status === "paid") {
        return new Response(JSON.stringify({ success: true, message: "Already paid" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await supabase.from("transactions").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", transaction.id);
      await handlePostPayment(supabase, transaction);

      return new Response(JSON.stringify({ success: true, transactionId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } else if (isCashify) {
      // === CASHIFY WEBHOOK ===
      // Validate webhook key
      const { data: whSetting } = await supabase
        .from("app_settings").select("value").eq("key", "cashify_webhook_key").maybeSingle();
      
      const providedKey = body.webhook_key || body.key || req.headers.get("X-Webhook-Key");
      if (whSetting?.value && providedKey !== whSetting.value) {
        return new Response(JSON.stringify({ error: "Invalid webhook key" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const cashifyTxId = body.transactionId;
      const status = body.status;

      if (status !== "paid" && status !== "success") {
        return new Response(JSON.stringify({ success: true, message: "Not paid" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Find our transaction by cashify mapping
      const { data: mappings } = await supabase
        .from("app_settings").select("key, value").eq("value", cashifyTxId).like("key", "cashify_tx_%");

      if (!mappings || mappings.length === 0) {
        // Fallback: try ref field
        const ref = body.ref || body.reference;
        if (ref) {
          const { data: tx } = await supabase.from("transactions").select("*").eq("transaction_id", ref).maybeSingle();
          if (tx && tx.status !== "paid") {
            await supabase.from("transactions").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", tx.id);
            await handlePostPayment(supabase, tx);
          }
        }
        return new Response(JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      for (const mapping of mappings) {
        const ourTxId = mapping.key.replace("cashify_tx_", "");
        const { data: transaction } = await supabase
          .from("transactions").select("*").eq("transaction_id", ourTxId).maybeSingle();

        if (transaction && transaction.status !== "paid") {
          await supabase.from("transactions").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", transaction.id);
          await handlePostPayment(supabase, transaction);
        }
        // Clean up mapping
        await supabase.from("site_settings").delete().eq("key", mapping.key);
      }

      return new Response(JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else {
      // Generic fallback
      const transactionId = body.ref || body.transaction_id || body.reference || body.order_id;
      if (!transactionId) {
        return new Response(JSON.stringify({ error: "Missing transaction identifier" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: transaction } = await supabase
        .from("transactions").select("*").eq("transaction_id", transactionId).maybeSingle();

      if (!transaction) {
        return new Response(JSON.stringify({ error: "Transaction not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (transaction.status !== "paid") {
        await supabase.from("transactions").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", transaction.id);
        await handlePostPayment(supabase, transaction);
      }

      return new Response(JSON.stringify({ success: true, transactionId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (error: unknown) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

async function handlePostPayment(supabase: any, transaction: any) {
  // Handle XCoins topup
  if (transaction.package_name === "XCOINS_TOPUP" && transaction.license_key) {
    const userId = transaction.license_key;
    const { data: user } = await supabase.from("xcoins_users").select("balance").eq("id", userId).single();
    if (user) {
      const newBalance = (user.balance || 0) + transaction.original_amount;
      await supabase.from("xcoins_users").update({ balance: newBalance, updated_at: new Date().toISOString() }).eq("id", userId);
      await supabase.from("xcoins_transactions").insert({
        user_id: userId, type: "topup", amount: transaction.original_amount,
        balance_after: newBalance, description: `Top-up via webhook`, reference_id: transaction.transaction_id,
      });
    }
  }

  // Discord notification
  try {
    const { data: discordSetting } = await supabase
      .from("site_settings").select("value").eq("key", "discord_webhook_url").maybeSingle();
    if (discordSetting?.value) {
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
      await fetch(discordSetting.value, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [embed] }),
      });
    }
  } catch (e) {
    console.error("Discord error:", e);
  }
}
