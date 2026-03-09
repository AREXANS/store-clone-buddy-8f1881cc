import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

function isBrowser(req: Request): boolean {
  // Avoid using User-Agent or Accept as primary signals (executors may spoof/send them).
  // Prefer modern browser-only headers.
  const secFetchMode = req.headers.get("sec-fetch-mode");
  const secFetchDest = req.headers.get("sec-fetch-dest");
  const secChUa = req.headers.get("sec-ch-ua");
  const upgrade = req.headers.get("upgrade-insecure-requests");
  return Boolean(secFetchMode || secFetchDest || secChUa || upgrade);
}

function accessDeniedPage(scriptName: string): string {
  const safeName = scriptName || "unknown";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>403 - Access Denied | Arexans</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{min-height:100vh;background:#0a0a0a;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative}
body::before{content:'';position:absolute;inset:0;background:
  linear-gradient(rgba(255,0,0,0.03) 1px,transparent 1px),
  linear-gradient(90deg,rgba(255,0,0,0.03) 1px,transparent 1px);
  background-size:60px 60px;pointer-events:none}
.glow{position:absolute;width:300px;height:300px;border-radius:50%;filter:blur(120px);opacity:0.15}
.glow-1{background:#ff0000;top:10%;left:20%}
.glow-2{background:#ff3333;bottom:15%;right:15%}
.glow-3{background:#cc0000;top:50%;left:60%;width:200px;height:200px}
.container{text-align:center;z-index:1;padding:2rem;max-width:520px}
.error-badge{display:inline-block;padding:8px 24px;border:1px solid rgba(255,60,60,0.4);border-radius:30px;font-size:13px;letter-spacing:3px;color:#ff4444;margin-bottom:28px;background:rgba(255,0,0,0.08)}
h1{font-size:clamp(2.5rem,8vw,4rem);font-weight:300;margin-bottom:20px;line-height:1.1}
h1 strong{font-weight:700}
.desc{color:#888;font-size:15px;line-height:1.7;margin-bottom:22px}
.highlight{color:#ff6666;font-weight:500}
.mini{color:#444;font-size:12px;letter-spacing:1px;margin-bottom:32px}
.btn{display:inline-flex;align-items:center;gap:8px;padding:12px 28px;background:rgba(255,50,50,0.12);border:1px solid rgba(255,60,60,0.3);border-radius:10px;color:#ff5555;font-size:14px;text-decoration:none;transition:all 0.3s}
.btn:hover{background:rgba(255,50,50,0.2);border-color:rgba(255,60,60,0.5);transform:translateY(-1px)}
.btn svg{width:18px;height:18px}
.footer{margin-top:40px;color:#444;font-size:12px;letter-spacing:1px}
</style>
</head>
<body>
  <div class="glow glow-1"></div>
  <div class="glow glow-2"></div>
  <div class="glow glow-3"></div>
  <div class="container">
    <div class="error-badge">4 0 3 &nbsp; E R R O R</div>
    <h1>Access <strong>Denied</strong></h1>
    <p class="desc">
      You don't have permission to access this resource.<br />
      <span class="highlight">@arexans</span> only [browser_sec_headers]
    </p>
    <div class="mini">Requested: <span class="highlight">${safeName.replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</span></div>
    <a href="/" class="btn">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      Return Home
    </a>
    <div class="footer">AREXANS SECURITY SYSTEM</div>
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

    // Browser → redirect to React /loader page
    if (!forceRaw && isBrowser(req)) {
      const redirectName = scriptName ? `?name=${encodeURIComponent(scriptName)}` : "";
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders, 
          "Location": `https://store-clone-buddy.lovable.app/loader${redirectName}`
        },
      });
    }

    // Executor/script requests → serve Lua
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

    // Embed script content directly as obfuscated byte array — no second HTTP call
    const obfuscatedContent = obfuscateString(script.content);
    const vS = randVar();
    const vExec = randVar();
    const vErr = randVar();
    const vLoad = randVar();

    const loaderScript = `-- Arexans Loader v4.1\n` +
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
