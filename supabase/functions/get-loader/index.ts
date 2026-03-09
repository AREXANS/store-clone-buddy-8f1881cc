import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function obfuscateString(str: string): string {
  const bytes = Array.from(new TextEncoder().encode(str));
  return `(function() local b={${bytes.join(",")}} local s="" for _,v in ipairs(b) do s=s..string.char(v) end return s end)()`;
}

function randVar(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let result = "_";
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function isExecutorRequest(req: Request): boolean {
  const userAgent = (req.headers.get("user-agent") || "").toLowerCase();
  const accept = (req.headers.get("accept") || "").toLowerCase();
  const secFetchMode = req.headers.get("sec-fetch-mode");
  const secFetchDest = req.headers.get("sec-fetch-dest");
  const xRequestedWith = (req.headers.get("x-requested-with") || "").toLowerCase();

  const executorUaPattern = /(roblox|wininet|synapse|fluxus|krnl|script-ware|delta|lua|executor|httpclient|curl|okhttp)/;
  const looksLikeApiClient = !secFetchMode && !secFetchDest && !accept.includes("text/html");

  return executorUaPattern.test(userAgent) || xRequestedWith === "roblox" || looksLikeApiClient;
}

function isBrowser(req: Request): boolean {
  if (isExecutorRequest(req)) return false;

  const secFetchMode = req.headers.get("sec-fetch-mode");
  const secFetchDest = req.headers.get("sec-fetch-dest");
  const secChUa = req.headers.get("sec-ch-ua");
  const upgrade = req.headers.get("upgrade-insecure-requests");
  const accept = (req.headers.get("accept") || "").toLowerCase();

  const isNavigation = secFetchMode === "navigate" || secFetchDest === "document";
  const hasBrowserHints = Boolean(secFetchMode || secFetchDest || secChUa || upgrade);
  const acceptsHtml = accept.includes("text/html");

  return isNavigation || hasBrowserHints || acceptsHtml;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const scriptName = url.searchParams.get("name");
    const rawParam = (url.searchParams.get("raw") || "").toLowerCase();
    const forceRaw = rawParam === "1" || rawParam === "true";

    if (!forceRaw && isBrowser(req)) {
      const deniedUrl = `https://tools.arexans.my.id/access-denied?name=${encodeURIComponent(scriptName || "unknown")}`;
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          Location: deniedUrl,
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    }

    if (!scriptName) {
      return new Response("-- Access Denied", {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: script, error } = await supabase
      .from("lua_scripts")
      .select("name, content, is_active")
      .eq("name", scriptName)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !script) {
      return new Response("-- [Arexans] Script not available.", {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const obfuscatedContent = obfuscateString(script.content);
    const vS = randVar();
    const vExec = randVar();
    const vErr = randVar();
    const vLoad = randVar();

    const loaderScript =
      `-- Arexans Loader v4.2\n` +
      `do\n` +
      `  local ${vLoad}=loadstring or load\n` +
      `  if not ${vLoad} then error("[Arexans] Executor missing loadstring/load") end\n` +
      `  local ${vS}=${obfuscatedContent}\n` +
      `  local ${vExec},${vErr}=pcall(function()\n` +
      `    local fn,err=${vLoad}(${vS})\n` +
      `    if not fn then error(err) end\n` +
      `    return fn()\n` +
      `  end)\n` +
      `  if not ${vExec} then warn("[Arexans] Runtime error") end\n` +
      `end\n`;

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
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  }
});
