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
      .in("key", ["cashify_license_key", "payment_mode", "discord_webhook_url", "create_key_api_url", "payment_simulation"]);

    const settingsMap = Object.fromEntries(
      (settings || []).map((s: { key: string; value: string }) => [s.key, s.value])
    );

    const paymentMode = settingsMap.payment_mode || "demo";
    const licenseKey = settingsMap.cashify_license_key || "";
    const paymentSimulation = settingsMap.payment_simulation || "off";

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
    if (paymentMode === "live" && licenseKey) {
      try {
        console.log("Checking payment status for:", transactionId);
        
        const cashifyResponse = await fetch("https://cashify.my.id/api/generate/check-status", {
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
        console.log("Cashify check-status response:", JSON.stringify(cashifyData));

        if (cashifyData.status === 200 && cashifyData.data?.status === "paid") {
          // Update transaction status
          await supabase
            .from("transactions")
            .update({ 
              status: "paid", 
              paid_at: new Date().toISOString() 
            })
            .eq("transaction_id", transactionId);

          // Create license key via external API
          await createLicenseKey(transaction, settingsMap);

          // Send Discord webhook notification
          await sendDiscordNotification(transaction, settingsMap);

          return new Response(
            JSON.stringify({
              success: true,
              paid: true,
              transaction: { ...transaction, status: "paid" },
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (cashifyError) {
        console.error("Cashify check error:", cashifyError);
      }
    }

    // Simulation mode - instant success when enabled
    if (paymentSimulation === "on") {
      console.log("Payment simulation enabled - auto completing payment");
      
      await supabase
        .from("transactions")
        .update({ 
          status: "paid", 
          paid_at: new Date().toISOString() 
        })
        .eq("transaction_id", transactionId);

      // Create license key via external API
      await createLicenseKey(transaction, settingsMap);

      return new Response(
        JSON.stringify({
          success: true,
          paid: true,
          transaction: { ...transaction, status: "paid" },
          mode: "simulation",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

        // Create license key via external API
        await createLicenseKey(transaction, settingsMap);

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

async function createLicenseKey(transaction: any, settingsMap: Record<string, string>) {
  try {
    // Use external AXS Key System API
    const createKeyApiUrl = "https://tvnoeugyucdanyjsrkvg.supabase.co/functions/v1/create-key";
    
    if (!transaction.license_key) {
      console.log("No license key to create");
      return;
    }

    // Calculate expiry date based on package duration
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + (transaction.package_duration || 30));

    const keyData = {
      key: transaction.license_key,
      role: transaction.package_name || "NORMAL",
      expired: expiryDate.toISOString(),
      max_hwid: 1
    };

    console.log("Creating license key via AXS API:", keyData);

    const response = await fetch(createKeyApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(keyData),
    });

    const result = await response.json();
    console.log("AXS Create key result:", result);
    
    if (result.success) {
      console.log("License key created successfully:", result.key);
    } else {
      console.error("Failed to create license key:", result.error);
    }
    
    return result;
  } catch (error) {
    console.error("Create key error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function sendDiscordNotification(transaction: any, settingsMap: Record<string, string>) {
  try {
    const webhookUrl = settingsMap.discord_webhook_url;

    if (!webhookUrl) {
      console.log("No Discord webhook URL configured");
      return;
    }

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

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });

    console.log("Discord notification sent");
  } catch (error) {
    console.error("Discord webhook error:", error);
  }
}
