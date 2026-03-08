import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Simple string obfuscation - converts string to byte array representation in Lua
function obfuscateString(str: string): string {
  const bytes = Array.from(new TextEncoder().encode(str));
  return `(function() local b={${bytes.join(",")}} local s="" for _,v in ipairs(b) do s=s..string.char(v) end return s end)()`;
}

// Generate a randomized variable name
function randVar(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let result = "_";
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const scriptName = url.searchParams.get("name");

    if (!scriptName) {
      return new Response("-- Access Denied", {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify script exists and is active
    const { data: script, error } = await supabase
      .from("lua_scripts")
      .select("name, is_active")
      .eq("name", scriptName)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !script) {
      return new Response("-- [Arexans] Script not available.", {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    // Build the real script URL with token (this stays hidden inside obfuscated loader)
    const SCRIPT_ACCESS_TOKEN = "AXS-SECURE-2026-RBLX";
    const realScriptUrl = `${supabaseUrl}/functions/v1/get-script?name=${scriptName}&token=${SCRIPT_ACCESS_TOKEN}`;

    // Generate random variable names for obfuscation
    const vHttp = randVar();
    const vUrl = randVar();
    const vRes = randVar();
    const vExec = randVar();
    const vErr = randVar();
    const vS = randVar();
    const vR = randVar();

    // Create obfuscated loader - the URL is encoded as byte array, not plain text
    const obfuscatedUrl = obfuscateString(realScriptUrl);
    
    const loaderScript = `-- Arexans Loader v3.0
-- Protected script loader
do
  local ${vHttp}=game:GetService("HttpService")
  local ${vUrl}=${obfuscatedUrl}
  local ${vS},${vRes}=pcall(function()
    local ${vR}=nil
    if request then
      local _r=request({Url=${vUrl},Method="GET"})
      ${vR}=_r.Body
    elseif syn and syn.request then
      local _r=syn.request({Url=${vUrl},Method="GET"})
      ${vR}=_r.Body
    elseif http_request then
      local _r=http_request({Url=${vUrl},Method="GET"})
      ${vR}=_r.Body
    else
      ${vR}=game:HttpGet(${vUrl})
    end
    return ${vR}
  end)
  if ${vS} and ${vRes} then
    local ${vExec},${vErr}=pcall(function() return loadstring(${vRes})() end)
    if not ${vExec} then warn("[Arexans] Runtime error") end
  else
    warn("[Arexans] Failed to connect")
  end
end`;

    return new Response(loaderScript, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error: unknown) {
    console.error("Error:", error);
    return new Response("-- [Arexans] Access Denied", {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }
});
