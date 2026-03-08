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
    const { transactionId, userId } = await req.json();

    if (!transactionId || !userId) {
      return new Response(JSON.stringify({ error: "Missing data" }), 
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get transaction
    const { data: tx } = await supabase.from('transactions')
      .select('*')
      .eq('transaction_id', transactionId)
      .eq('package_name', 'XCOINS_TOPUP')
      .maybeSingle();

    if (!tx) {
      return new Response(JSON.stringify({ error: "Transaction not found" }), 
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check if expired
    if (tx.expires_at && new Date(tx.expires_at) < new Date() && tx.status === 'pending') {
      await supabase.from('transactions').update({ status: 'expired' }).eq('id', tx.id);
      return new Response(JSON.stringify({ expired: true }), 
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (tx.status === 'paid') {
      // Already processed - return success
      const { data: user } = await supabase.from('xcoins_users').select('balance').eq('id', userId).single();
      return new Response(JSON.stringify({ paid: true, balance: user?.balance || 0 }), 
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check payment status (similar to check-payment)
    const { data: settings } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["cashify_license_key", "payment_mode", "payment_simulation"]);

    const settingsMap = Object.fromEntries((settings || []).map((s: any) => [s.key, s.value]));
    const paymentMode = settingsMap.payment_mode || "demo";
    const simulation = settingsMap.payment_simulation || "off";

    let isPaid = false;

    if (paymentMode === "demo" || simulation === "on") {
      // Auto-pay in demo/simulation after 5 seconds
      const createdAt = new Date(tx.created_at).getTime();
      if (Date.now() - createdAt > 5000) {
        isPaid = true;
      }
    } else if (paymentMode === "live" && settingsMap.cashify_license_key) {
      // Check Cashify
      const checkRes = await fetch(`https://cashify.my.id/api/check-payment/${transactionId}`, {
        headers: { "x-license-key": settingsMap.cashify_license_key }
      });
      const checkData = await checkRes.json();
      if (checkData.status === 200 && checkData.data?.isPaid) {
        isPaid = true;
      }
    }

    if (isPaid) {
      // Update transaction
      await supabase.from('transactions').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', tx.id);

      // Credit XCoins to user
      const { data: user } = await supabase.from('xcoins_users').select('balance').eq('id', userId).single();
      const xcoinsAmount = tx.original_amount; // 1 IDR = 1 XCoin
      const newBalance = (user?.balance || 0) + xcoinsAmount;

      await supabase.from('xcoins_users').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('id', userId);

      // Record XCoins transaction
      await supabase.from('xcoins_transactions').insert({
        user_id: userId,
        type: 'topup',
        amount: xcoinsAmount,
        balance_after: newBalance,
        description: `Top-up ${xcoinsAmount} XCoins via QRIS`,
        reference_id: transactionId
      });

      return new Response(JSON.stringify({ paid: true, balance: newBalance, added: xcoinsAmount }), 
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ paid: false, status: tx.status }), 
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: unknown) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
