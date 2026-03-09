import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function isBrowser(req: Request): boolean {
  const secFetchMode = req.headers.get("sec-fetch-mode");
  const secFetchDest = req.headers.get("sec-fetch-dest");
  const secChUa = req.headers.get("sec-ch-ua");
  const upgrade = req.headers.get("upgrade-insecure-requests");
  const userAgent = (req.headers.get("user-agent") || "").toLowerCase();
  const accept = req.headers.get("accept") || "";

  const hasBrowserClientHints = Boolean(secFetchMode || secFetchDest || secChUa || upgrade);
  const isCommonBrowserUA = /(mozilla|chrome|safari|firefox|edg|opera)/.test(userAgent);
  const acceptsHtml = accept.includes("text/html");

  return hasBrowserClientHints || isCommonBrowserUA || acceptsHtml;
}

function accessDeniedPage(scriptName: string): string {
  const safeName = (scriptName || "unknown").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<title>403 - Access Denied | Arexans</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{min-height:100vh;background:#0a0a0a;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative}
body::before{content:'';position:absolute;inset:0;background:linear-gradient(rgba(255,0,0,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,0,0,0.03) 1px,transparent 1px);background-size:60px 60px;pointer-events:none}
.glow{position:absolute;width:300px;height:300px;border-radius:50%;filter:blur(120px);opacity:0.15}
.g1{background:#ff0000;top:10%;left:20%}.g2{background:#ff3333;bottom:15%;right:15%}.g3{background:#cc0000;top:50%;left:60%;width:200px;height:200px}
.c{text-align:center;z-index:1;padding:2rem;max-width:520px}
.badge{display:inline-block;padding:8px 24px;border:1px solid rgba(255,60,60,0.4);border-radius:30px;font-size:13px;letter-spacing:3px;color:#ff4444;margin-bottom:28px;background:rgba(255,0,0,0.08)}
h1{font-size:clamp(2.5rem,8vw,4rem);font-weight:300;margin-bottom:20px}h1 strong{font-weight:700}
.desc{color:#888;font-size:15px;line-height:1.7;margin-bottom:22px}.hl{color:#ff6666;font-weight:500}
.mini{color:#444;font-size:12px;letter-spacing:1px;margin-bottom:32px}
.btn{display:inline-flex;align-items:center;gap:8px;padding:12px 28px;background:rgba(255,50,50,0.12);border:1px solid rgba(255,60,60,0.3);border-radius:10px;color:#ff5555;font-size:14px;text-decoration:none;transition:all .3s}
.btn:hover{background:rgba(255,50,50,0.2);transform:translateY(-1px)}
.ft{margin-top:40px;color:#444;font-size:12px;letter-spacing:1px}
</style>
</head>
<body>
<div class="glow g1"></div><div class="glow g2"></div><div class="glow g3"></div>
<div class="c">
  <div class="badge">4 0 3 &nbsp; E R R O R</div>
  <h1>Access <strong>Denied</strong></h1>
  <p class="desc">You don't have permission to access this resource.<br/><span class="hl">@arexans</span> protected endpoint</p>
  <div class="mini">Requested: <span class="hl">${safeName}</span></div>
  <a href="https://tools.arexans.my.id/" class="btn">
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
    Return Home
  </a>
  <div class="ft">AREXANS SECURITY SYSTEM</div>
</div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const scriptName = url.searchParams.get("name");
    const rawParam = (url.searchParams.get("raw") || "").toLowerCase();
    const forceRaw = rawParam === "1" || rawParam === "true";

    if (!scriptName) {
      return new Response("-- Access Denied: Invalid request", {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // Browser → redirect to SPA Access Denied page to guarantee proper HTML rendering
    if (!forceRaw && isBrowser(req)) {
      const deniedUrl = `https://tools.arexans.my.id/access-denied?name=${encodeURIComponent(scriptName)}`;
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          Location: deniedUrl,
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    }

    // Executor/script requests → serve raw Lua
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
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    }

    return new Response(script.content, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error: unknown) {
    console.error("Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(`warn("[Arexans] Error: ${msg.replaceAll('"', "'")}")`, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  }
});
