import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const noCacheHeaders = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  Vary: "Accept, User-Agent, Sec-Fetch-Mode, Sec-Fetch-Dest, Sec-CH-UA, Upgrade-Insecure-Requests, X-Requested-With",
};

const USER_SCRIPT_MARKER = "-- USER SCRIPT (PROTECTED)";

function extractProtectedRaw(content: string): string | null {
  const b64Match = content.match(/-- AREXANS_RAW_B64:([^\r\n]+)/);
  if (b64Match?.[1]) {
    try {
      const binary = atob(b64Match[1]);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    } catch (_error) {
      // Fall back to legacy marker parsing.
    }
  }

  const markerIndex = content.indexOf(USER_SCRIPT_MARKER);
  if (markerIndex === -1) return null;
  return content
    .slice(markerIndex + USER_SCRIPT_MARKER.length)
    .replace(/^\r?\n-- ={10,}\r?\n/, "")
    .replace(/^\r?\n/, "")
    .replace(/\n$/, "");
}

function buildLegacyRemoteWrapper(scriptName: string, content: string): string | null {
  const markerIndex = content.indexOf(USER_SCRIPT_MARKER);
  if (markerIndex === -1 || content.includes("-- AREXANS_RAW_B64:")) return null;

  const gate = content.slice(0, markerIndex);
  const rawUrlSuffix = `/get-script?name=${encodeURIComponent(scriptName)}&raw=1&unwrap=1`;
  return `${gate}
-- ============================================================
-- USER SCRIPT (PROTECTED, REMOTE RAW)
-- ============================================================
local __arexans_raw_url = API_BASE .. "${rawUrlSuffix}"
local __arexans_res = httpRequest({ Url = __arexans_raw_url, Method = "GET" })
if not __arexans_res or not __arexans_res.Body or __arexans_res.Body == "" then
    error("[ArexansTools] Gagal mengambil script asli")
end
local __arexans_load = loadstring or load
if not __arexans_load then error("[ArexansTools] Executor tidak support loadstring/load") end
local __arexans_fn, __arexans_err = __arexans_load(__arexans_res.Body)
if not __arexans_fn then error(__arexans_err) end
return __arexans_fn()
`;
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
    return new Response("ok", { headers: { ...corsHeaders, ...noCacheHeaders } });
  }

  try {
    const url = new URL(req.url);
    const scriptName = url.searchParams.get("name");
    const rawParam = (url.searchParams.get("raw") || "").toLowerCase();
    const forceRaw = rawParam === "1" || rawParam === "true";

    if (!scriptName) {
      return new Response("-- Access Denied: Invalid request", {
        status: 403,
        headers: { ...corsHeaders, ...noCacheHeaders, "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    if (!forceRaw && isBrowser(req)) {
      const deniedUrl = `https://tools.arexans.my.id/access-denied?name=${encodeURIComponent(scriptName)}`;
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          ...noCacheHeaders,
          Location: deniedUrl,
        },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: script, error } = await supabase
      .from("lua_scripts")
      .select("content, is_active")
      .eq("name", scriptName)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !script) {
      return new Response('warn("[Arexans] Script not available")', {
        status: 200,
        headers: {
          ...corsHeaders,
          ...noCacheHeaders,
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    return new Response(script.content, {
      status: 200,
      headers: {
        ...corsHeaders,
        ...noCacheHeaders,
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (error: unknown) {
    console.error("Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(`warn("[Arexans] Error: ${msg.replaceAll('"', "'")}")`, {
      status: 200,
      headers: { ...corsHeaders, ...noCacheHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  }
});
