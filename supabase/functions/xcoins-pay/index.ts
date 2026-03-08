import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return new TextDecoder().decode(encode(new Uint8Array(hash)));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { userId, pin, amount, packageName, packageDuration, licenseKey } = await req.json();

    if (!userId || !pin || !amount || !packageName || !packageDuration || !licenseKey) {
      return new Response(JSON.stringify({ error: "Data tidak lengkap" }), 
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify user & PIN
    const { data: user } = await supabase.from('xcoins_balances').select('*').eq('id', userId).single();
    if (!user) {
      return new Response(JSON.stringify({ error: "User tidak ditemukan" }), 
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const pinHash = await hashPin(pin);
    if (pinHash !== user.pin_hash) {
      return new Response(JSON.stringify({ error: "PIN salah" }), 
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (user.balance < amount) {
      return new Response(JSON.stringify({ error: `Saldo tidak cukup. Saldo: ${user.balance} XCoins, Harga: ${amount} XCoins` }), 
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Deduct balance
    const newBalance = user.balance - amount;
    await supabase.from('xcoins_balances').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('id', userId);

    const transactionId = `XPAY-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Record XCoins transaction
    await supabase.from('xcoins_transactions').insert({
      user_id: userId,
      type: 'purchase',
      amount: -amount,
      balance_after: newBalance,
      description: `Beli ${packageName} ${packageDuration} hari - ${licenseKey}`,
      reference_id: transactionId
    });

    // Create payment transaction (auto-paid)
    await supabase.from("transactions").insert({
      transaction_id: transactionId,
      customer_name: user.display_name || user.phone,
      package_name: packageName,
      package_duration: packageDuration,
      original_amount: amount,
      total_amount: amount,
      status: "paid",
      license_key: licenseKey,
      paid_at: new Date().toISOString(),
      customer_whatsapp: user.phone,
    });

    return new Response(JSON.stringify({
      success: true,
      transactionId,
      newBalance,
      paid: true
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: unknown) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
