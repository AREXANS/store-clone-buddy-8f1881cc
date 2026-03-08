import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Order matters for foreign key dependencies
const RESTORE_ORDER = [
  "app_settings",
  "packages",
  "ads",
  "backgrounds",
  "social_links",
  "admin_sessions",
  "lua_scripts",
  "package_discounts",
  "xcoins_users",
  "xcoins_otp",
  "xcoins_transactions",
  "transactions",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { tables, mode = "merge" } = body as {
      tables: Record<string, any[]>;
      mode: "merge" | "replace";
    };

    if (!tables || typeof tables !== "object") {
      return new Response(
        JSON.stringify({ error: "Invalid backup format. Expected { tables: { ... } }" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Record<string, { inserted: number; errors: string[] }> = {};

    for (const table of RESTORE_ORDER) {
      if (!tables[table] || !Array.isArray(tables[table]) || tables[table].length === 0) continue;

      const tableResults = { inserted: 0, errors: [] as string[] };

      // In replace mode, clear existing data first
      if (mode === "replace") {
        const { error: deleteError } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (deleteError) {
          tableResults.errors.push(`Clear failed: ${deleteError.message}`);
        }
      }

      // Insert in batches of 100
      const rows = tables[table];
      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        
        const { error } = await supabase.from(table).upsert(batch, {
          onConflict: "id",
          ignoreDuplicates: false,
        });

        if (error) {
          tableResults.errors.push(`Batch ${Math.floor(i / 100) + 1}: ${error.message}`);
        } else {
          tableResults.inserted += batch.length;
        }
      }

      results[table] = tableResults;
    }

    // Handle any tables not in RESTORE_ORDER
    for (const table of Object.keys(tables)) {
      if (RESTORE_ORDER.includes(table)) continue;
      results[table] = { inserted: 0, errors: [`Table "${table}" not supported for restore`] };
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode,
        restoredAt: new Date().toISOString(),
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
