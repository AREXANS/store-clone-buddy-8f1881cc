import { FC, useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import {
  Upload, Trash2, RefreshCw, FileCode, Copy, ExternalLink, Shield,
  History as HistoryIcon, Undo2, Redo2, RotateCcw, Download, Replace, Pencil, Save,
} from 'lucide-react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

interface UploadedScript {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  content: string;
  script_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ScriptVersion {
  id: string;
  script_id: string;
  version_number: number;
  content: string;
  display_name: string | null;
  created_at: string;
}

/**
 * Protection wrapper: integrasi key system + whitelist + session cache.
 * Saat dieksekusi:
 *   1) Cek ArexansTools/ArexansTools_Session.json → kalau ada key valid, jalan langsung.
 *   2) Cek whitelist username (manual + license robloxUsers) di server.
 *   3) Kalau tidak whitelist, prompt input AXS key → simpan ke session file.
 *   4) Kalau key invalid → fake script.
 */
const PROTECTION_WRAPPER = (apiBase: string, scriptName: string, _userScript: string) => `--[[
============================================================
 ArexansTools — Auto-Protected Bootstrap (v3)
 - Session cache (file-presence only, no extra network round-trip)
 - Whitelist check
 - Floating Key System UI (cyan-blue style)
 - Payload streamed terpisah supaya script besar tetap aman
============================================================
]]
local HttpService = game:GetService("HttpService")
local CoreGui = game:GetService("CoreGui")
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")

local LocalPlayer = Players.LocalPlayer or Players.PlayerAdded:Wait()
local username    = LocalPlayer.Name

local API_BASE         = "${apiBase}"
local SCRIPT_NAME      = "${scriptName}"

local function urlEncode(str)
    str = tostring(str or "")
    return (str:gsub("([^%w%-%_%.%~])", function(c) return string.format("%%%02X", string.byte(c)) end))
end

local PAYLOAD_URL      = API_BASE .. "/get-script?name=" .. urlEncode(SCRIPT_NAME) .. "&payload=1&raw=1"
local WHITELIST_API    = API_BASE .. "/get-whitelist?format=json"
local FAKE_SCRIPT_API  = API_BASE .. "/get-fake-script"
local VALIDATE_KEY_API = API_BASE .. "/validate-key"

local SESSION_FOLDER   = "ArexansTools"
local SESSION_FILE     = SESSION_FOLDER .. "/ArexansTools_Session.json"

if not _G.Arexans_Connections then _G.Arexans_Connections = {} end
local function ConnectEvent(event, func)
    local conn = event:Connect(func)
    table.insert(_G.Arexans_Connections, conn)
    return conn
end

local function getHwid()
    local ok, id = pcall(function() return game:GetService("RbxAnalyticsService"):GetClientId() end)
    return ok and id or (LocalPlayer.UserId .. "_fallback")
end
local HWID = getHwid()

local function safeRead()
    if not (isfile and readfile) then return nil end
    if not isfile(SESSION_FILE) then return nil end
    local ok, raw = pcall(readfile, SESSION_FILE)
    if not ok or not raw or raw == "" then return nil end
    local ok2, data = pcall(function() return HttpService:JSONDecode(raw) end)
    if ok2 and type(data) == "table" then return data end
    return nil
end

local function safeWrite(tbl)
    if not (writefile and makefolder) then return end
    pcall(function()
        if isfolder and not isfolder(SESSION_FOLDER) then makefolder(SESSION_FOLDER) end
        writefile(SESSION_FILE, HttpService:JSONEncode(tbl))
    end)
end

local function httpRequest(opts)
    local req = (syn and syn.request) or (http and http.request) or (fluxus and fluxus.request) or request or http_request
    if not req then
        local ok, body = pcall(function() return game:HttpGet(opts.Url) end)
        return ok and { StatusCode = 200, Body = body } or nil
    end
    local ok, res = pcall(req, opts)
    return ok and res or nil
end

local function loadLuaString(source, label)
    local loader = loadstring or load
    if type(loader) ~= "function" then warn("[ArexansTools] Executor tanpa loadstring/load."); return nil end
    if type(source) ~= "string" or source == "" then return nil end
    local fn, compileErr = loader(source)
    if type(fn) ~= "function" then warn("[ArexansTools] " .. tostring(label) .. " compile error: " .. tostring(compileErr)); return nil end
    return fn
end

local function MakeDraggable(guiObject, dragHandle)
    local dragInput, dragStart, startPos
    ConnectEvent(dragHandle.InputBegan, function(input)
        if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
            dragInput = input; dragStart = input.Position; startPos = guiObject.Position
        end
    end)
    ConnectEvent(UserInputService.InputChanged, function(input)
        if dragInput and (input.UserInputType == Enum.UserInputType.MouseMovement or input == dragInput) then
            local d = input.Position - dragStart
            guiObject.Position = UDim2.new(startPos.X.Scale, startPos.X.Offset + d.X, startPos.Y.Scale, startPos.Y.Offset + d.Y)
        end
    end)
    ConnectEvent(UserInputService.InputEnded, function(input)
        if dragInput and input.UserInputType == dragInput.UserInputType then dragInput = nil end
    end)
end

-- 1) Session cache: file-presence only (tidak validasi online → tidak nge-block payload)
local function tryCachedKey()
    local data = safeRead()
    if data and data.key and data.key ~= "" then
        print("[ArexansTools] Session ditemukan (role: " .. tostring(data.role or "Unknown") .. ")")
        return true
    end
    return false
end

local function checkWhitelist()
    local res = httpRequest({ Url = WHITELIST_API, Method = "GET" })
    if not res or not res.Body then return false end
    local ok, data = pcall(function() return HttpService:JSONDecode(res.Body) end)
    if not (ok and data and data.success and data.usernames) then return false end
    local lname = string.lower(username)
    for _, u in ipairs(data.usernames) do
        if string.lower(u) == lname then return true end
    end
    return false
end

local function showKeyPromptUI()
    local parentGui = CoreGui
    local okp, pg = pcall(function() return Players.LocalPlayer:WaitForChild("PlayerGui") end)
    if not okp or not pg then pg = CoreGui end
    pcall(function() if parentGui:FindFirstChild("ArexansKeySystemGUI") then parentGui.ArexansKeySystemGUI:Destroy() end end)
    pcall(function() if pg:FindFirstChild("ArexansKeySystemGUI") then pg.ArexansKeySystemGUI:Destroy() end end)

    local function ButtonFx(button, flash)
        button.AutoButtonColor = false
        local orig = button.BackgroundTransparency
        local us = button:FindFirstChild("BFX") or Instance.new("UIScale", button); us.Name = "BFX"
        button.MouseButton1Down:Connect(function()
            TweenService:Create(us, TweenInfo.new(0.1), {Scale = 0.95}):Play()
            if flash then TweenService:Create(button, TweenInfo.new(0.1), {BackgroundTransparency = math.max(0, orig - 0.2)}):Play() end
        end)
        local function restore()
            TweenService:Create(us, TweenInfo.new(0.1), {Scale = 1}):Play()
            if flash then TweenService:Create(button, TweenInfo.new(0.2), {BackgroundTransparency = orig}):Play() end
        end
        button.MouseButton1Up:Connect(restore); button.MouseLeave:Connect(restore)
    end

    local keyGui = Instance.new("ScreenGui")
    keyGui.Name = "ArexansKeySystemGUI"; keyGui.ResetOnSpawn = false
    keyGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling; keyGui.DisplayOrder = 999
    local pOk = pcall(function() keyGui.Parent = CoreGui end)
    if not pOk then keyGui.Parent = pg end

    local Frame = Instance.new("Frame", keyGui)
    Frame.Size = UDim2.new(0, 280, 0, 150); Frame.Position = UDim2.new(0.5, -140, 0.5, -75)
    Frame.BackgroundColor3 = Color3.fromRGB(10, 10, 10); Frame.BackgroundTransparency = 0.2; Frame.BorderSizePixel = 0
    Instance.new("UICorner", Frame).CornerRadius = UDim.new(0, 8)
    local fs = Instance.new("UIStroke", Frame); fs.Color = Color3.fromRGB(0, 150, 255); fs.Thickness = 3

    local TitleBar = Instance.new("TextButton", Frame)
    TitleBar.Size = UDim2.new(1, 0, 0, 35); TitleBar.BackgroundTransparency = 1; TitleBar.Text = ""; TitleBar.AutoButtonColor = false

    local TitleLbl = Instance.new("TextLabel", TitleBar)
    TitleLbl.Size = UDim2.new(1, -40, 1, 0); TitleLbl.Position = UDim2.new(0, 10, 0, 0)
    TitleLbl.BackgroundTransparency = 1; TitleLbl.Text = "Arexans Key System"
    TitleLbl.Font = Enum.Font.GothamBold; TitleLbl.TextColor3 = Color3.fromRGB(255, 255, 255)
    TitleLbl.TextSize = 16; TitleLbl.TextXAlignment = Enum.TextXAlignment.Left
    local grad = Instance.new("UIGradient", TitleLbl)
    grad.Color = ColorSequence.new({
        ColorSequenceKeypoint.new(0, Color3.fromRGB(0, 150, 255)),
        ColorSequenceKeypoint.new(0.5, Color3.fromRGB(0, 255, 255)),
        ColorSequenceKeypoint.new(1, Color3.fromRGB(0, 150, 255)),
    })
    grad.Rotation = 45
    task.spawn(function()
        while TitleLbl.Parent do grad.Rotation = (tick() * 50) % 360; RunService.Heartbeat:Wait() end
    end)

    local CloseBtn = Instance.new("TextButton", TitleBar)
    CloseBtn.Size = UDim2.new(0, 25, 0, 25); CloseBtn.Position = UDim2.new(1, -30, 0.5, 0); CloseBtn.AnchorPoint = Vector2.new(0, 0.5)
    CloseBtn.BackgroundColor3 = Color3.fromRGB(200, 50, 50); CloseBtn.BackgroundTransparency = 1
    CloseBtn.Text = "X"; CloseBtn.Font = Enum.Font.GothamBold; CloseBtn.TextColor3 = Color3.fromRGB(255, 100, 100); CloseBtn.TextSize = 16
    Instance.new("UICorner", CloseBtn).CornerRadius = UDim.new(0, 4)
    local cs = Instance.new("UIStroke", CloseBtn); cs.Color = Color3.fromRGB(255, 100, 100); cs.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
    ButtonFx(CloseBtn, true)

    local Sep = Instance.new("Frame", Frame)
    Sep.Size = UDim2.new(1, -20, 0, 1); Sep.Position = UDim2.new(0, 10, 0, 35)
    Sep.BackgroundColor3 = Color3.fromRGB(0, 150, 255); Sep.BackgroundTransparency = 0.5; Sep.BorderSizePixel = 0

    local KeyBox = Instance.new("TextBox", Frame)
    KeyBox.Size = UDim2.new(1, -20, 0, 35); KeyBox.Position = UDim2.new(0, 10, 0, 45)
    KeyBox.BackgroundColor3 = Color3.fromRGB(30, 30, 40); KeyBox.BackgroundTransparency = 1
    KeyBox.TextColor3 = Color3.fromRGB(0, 150, 255); KeyBox.PlaceholderText = "Masukkan key..."
    KeyBox.PlaceholderColor3 = Color3.fromRGB(0, 100, 180); KeyBox.Text = ""
    KeyBox.Font = Enum.Font.GothamBold; KeyBox.TextSize = 14; KeyBox.ClearTextOnFocus = false
    Instance.new("UICorner", KeyBox).CornerRadius = UDim.new(0, 6)
    local ks = Instance.new("UIStroke", KeyBox); ks.Color = Color3.fromRGB(0, 150, 255); ks.ApplyStrokeMode = Enum.ApplyStrokeMode.Border

    local Btns = Instance.new("Frame", Frame)
    Btns.Size = UDim2.new(1, -20, 0, 35); Btns.Position = UDim2.new(0, 10, 0, 90); Btns.BackgroundTransparency = 1

    local GetKeyBtn = Instance.new("TextButton", Btns)
    GetKeyBtn.Size = UDim2.new(0.48, 0, 1, 0); GetKeyBtn.BackgroundColor3 = Color3.fromRGB(0, 150, 255); GetKeyBtn.BackgroundTransparency = 1
    GetKeyBtn.Text = "Get Key"; GetKeyBtn.Font = Enum.Font.GothamBold; GetKeyBtn.TextColor3 = Color3.fromRGB(0, 150, 255); GetKeyBtn.TextSize = 14
    Instance.new("UICorner", GetKeyBtn).CornerRadius = UDim.new(0, 6)
    local gks = Instance.new("UIStroke", GetKeyBtn); gks.Color = Color3.fromRGB(0, 150, 255); gks.ApplyStrokeMode = Enum.ApplyStrokeMode.Border

    local LoginBtn = Instance.new("TextButton", Btns)
    LoginBtn.Size = UDim2.new(0.48, 0, 1, 0); LoginBtn.Position = UDim2.new(0.52, 0, 0, 0)
    LoginBtn.BackgroundColor3 = Color3.fromRGB(0, 150, 255); LoginBtn.BackgroundTransparency = 1
    LoginBtn.Text = "Login"; LoginBtn.Font = Enum.Font.GothamBold; LoginBtn.TextColor3 = Color3.fromRGB(0, 150, 255); LoginBtn.TextSize = 14
    Instance.new("UICorner", LoginBtn).CornerRadius = UDim.new(0, 6)
    local lgs = Instance.new("UIStroke", LoginBtn); lgs.Color = Color3.fromRGB(0, 150, 255); lgs.ApplyStrokeMode = Enum.ApplyStrokeMode.Border

    local Status = Instance.new("TextLabel", Frame)
    Status.Size = UDim2.new(1, -20, 0, 20); Status.Position = UDim2.new(0, 10, 1, -25); Status.BackgroundTransparency = 1
    Status.Text = ""; Status.Font = Enum.Font.GothamBold; Status.TextColor3 = Color3.fromRGB(0, 150, 255); Status.TextSize = 14

    pcall(function() MakeDraggable(Frame, TitleBar) end)
    ButtonFx(GetKeyBtn, true); ButtonFx(LoginBtn, true)

    local result = { done = false, key = nil, cancelled = false }
    local busy = false

    CloseBtn.MouseButton1Click:Connect(function()
        result.cancelled = true; result.done = true
        pcall(function() keyGui:Destroy() end)
    end)

    GetKeyBtn.MouseButton1Click:Connect(function()
        if setclipboard then
            setclipboard("https://tools.arexans.my.id")
            Status.Text = "Link disalin!"; Status.TextColor3 = Color3.fromRGB(100, 255, 100)
        else
            Status.Text = "Clipboard tidak didukung"; Status.TextColor3 = Color3.fromRGB(255, 100, 100)
        end
    end)

    local function attemptLogin()
        if busy then return end
        local key = KeyBox.Text
        if not key or key == "" then
            Status.Text = "Masukkan key terlebih dahulu"; Status.TextColor3 = Color3.fromRGB(255, 200, 50); return
        end
        busy = true; Status.Text = "Memvalidasi..."; Status.TextColor3 = Color3.fromRGB(255, 255, 100); LoginBtn.Text = "..."
        task.spawn(function()
            local res = httpRequest({
                Url = VALIDATE_KEY_API, Method = "POST",
                Headers = { ["Content-Type"] = "application/json" },
                Body = HttpService:JSONEncode({ key = key, hwid = HWID, robloxUsername = username }),
            })
            busy = false; LoginBtn.Text = "Login"
            if not res or not res.Body then
                Status.Text = "Gagal terhubung ke server"; Status.TextColor3 = Color3.fromRGB(255, 100, 100); return
            end
            local ok, parsed = pcall(function() return HttpService:JSONDecode(res.Body) end)
            if ok and parsed and parsed.success and parsed.valid then
                safeWrite({ key = key, savedAt = os.time(), role = parsed.role })
                Status.Text = (parsed.role or "Member") .. " | Valid"
                Status.TextColor3 = Color3.fromRGB(100, 255, 100)
                task.wait(0.6)
                result.key = key; result.done = true
                pcall(function() keyGui:Destroy() end)
            else
                local err = (parsed and (parsed.error or parsed.message)) or "Key tidak valid"
                Status.Text = tostring(err); Status.TextColor3 = Color3.fromRGB(255, 100, 100)
            end
        end)
    end

    LoginBtn.MouseButton1Click:Connect(attemptLogin)
    KeyBox.FocusLost:Connect(function(enter) if enter then attemptLogin() end end)

    local timeout = tick() + 600
    while not result.done and tick() < timeout do task.wait(0.2) end
    if not result.done then pcall(function() keyGui:Destroy() end) end
    return result.key
end

local function promptAndSaveKey()
    local key = showKeyPromptUI()
    return key ~= nil and key ~= ""
end

local function runFake()
    local res = httpRequest({ Url = FAKE_SCRIPT_API, Method = "GET" })
    if res and res.Body then
        local fn = loadLuaString(res.Body, "fake")
        if fn then pcall(fn) end
    else
        warn("[ArexansTools] Akses ditolak.")
    end
end

local authorized = false
if tryCachedKey() then
    authorized = true
    print("[ArexansTools] Akses diizinkan melalui cache lokal.")
elseif checkWhitelist() then
    authorized = true
    print("[ArexansTools] Whitelist verified for " .. username)
elseif promptAndSaveKey() then
    authorized = true
end

if not authorized then runFake(); return end

print("[ArexansTools] Access granted. Fetching payload...")

local payloadRes = httpRequest({ Url = PAYLOAD_URL, Method = "GET" })
if not payloadRes or not payloadRes.Body or payloadRes.Body == "" then
    warn("[ArexansTools] Gagal mengambil payload script.")
    return
end

local fn = loadLuaString(payloadRes.Body, "payload")
if not fn then return end

if getgenv then
    getgenv().AREXANS_SCRIPT_NAME = SCRIPT_NAME
    getgenv().AREXANS_PAYLOAD_URL = PAYLOAD_URL
end

local ok, resultOrErr = pcall(fn)
if not ok then
    warn("[ArexansTools] Payload runtime error: " .. tostring(resultOrErr))
elseif type(resultOrErr) == "function" then
    local ok2, err2 = pcall(resultOrErr)
    if not ok2 then warn("[ArexansTools] Payload returned function error: " .. tostring(err2)) end
end
`;

const LuaUploadManager: FC = () => {
  const [scripts, setScripts] = useState<UploadedScript[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [rewrapping, setRewrapping] = useState(false);
  const [versions, setVersions] = useState<ScriptVersion[]>([]);
  const [historyScript, setHistoryScript] = useState<UploadedScript | null>(null);
  const [previewVersion, setPreviewVersion] = useState<ScriptVersion | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const SUPABASE_API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

  const fetchScripts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('lua_scripts')
        .select('*')
        .eq('script_type', 'uploaded')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setScripts(data || []);
    } catch (e) {
      toast({ title: 'Error', description: 'Gagal mengambil scripts', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchScripts(); }, []);

  const wrap = (name: string, raw: string) => PROTECTION_WRAPPER(SUPABASE_API_BASE, name, raw);

  const unwrap = (wrapped: string): string => {
    const marker = '-- USER SCRIPT (PROTECTED)';
    const idx = wrapped.indexOf(marker);
    if (idx === -1) return wrapped;
    const afterMarker = wrapped.substring(idx + marker.length);
    const nl = afterMarker.indexOf('\n');
    return afterMarker.substring(nl + 1).replace(/\n$/, '');
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!['.lua', '.txt'].includes(ext)) {
      toast({ title: 'Error', description: 'Hanya .lua atau .txt', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const raw = await file.text();
      const scriptName = file.name.replace(/\.(lua|txt)$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
      const dbName = `uploaded_${scriptName}`;
      const wrapped = wrap(dbName, raw);

      const { data: existing } = await supabase.from('lua_scripts').select('id').eq('name', dbName).maybeSingle();
      if (existing) {
        const { error } = await supabase.from('lua_scripts')
          .update({ content: wrapped, raw_content: raw, updated_at: new Date().toISOString() } as any).eq('id', existing.id);
        if (error) throw error;
        toast({ title: 'Berhasil', description: `"${file.name}" diupdate (key + whitelist auto-terintegrasi)` });
      } else {
        const { error } = await supabase.from('lua_scripts').insert({
          name: dbName, display_name: file.name,
          description: 'Auto-integrated: key system + whitelist',
          content: wrapped, raw_content: raw, script_type: 'uploaded', is_active: true,
        } as any);
        if (error) throw error;
        toast({ title: 'Berhasil', description: `"${file.name}" diupload (key + whitelist auto-terintegrasi)` });
      }
      fetchScripts();
    } catch (e) {
      toast({ title: 'Error', description: 'Gagal upload', variant: 'destructive' });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const reWrapAll = async () => {
    if (!confirm('Re-wrap semua script dengan wrapper terbaru (key system + whitelist)?')) return;
    setRewrapping(true);
    try {
      for (const s of scripts) {
        const raw = (s as any).raw_content || unwrap(s.content);
        const newWrapped = wrap(s.name, raw);
        await supabase.from('lua_scripts').update({
          content: newWrapped, raw_content: raw, updated_at: new Date().toISOString(),
        } as any).eq('id', s.id);
      }
      toast({ title: 'Berhasil', description: `${scripts.length} script di-rewrap` });
      fetchScripts();
    } catch (e) {
      toast({ title: 'Error', description: 'Gagal re-wrap', variant: 'destructive' });
    } finally {
      setRewrapping(false);
    }
  };

  const deleteScript = async (id: string, name: string) => {
    try {
      const { error } = await supabase.from('lua_scripts').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Berhasil', description: `"${name}" dihapus` });
      fetchScripts();
    } catch {
      toast({ title: 'Error', description: 'Gagal menghapus', variant: 'destructive' });
    }
  };

  const openHistory = async (script: UploadedScript) => {
    setHistoryScript(script);
    setPreviewVersion(null);
    const { data, error } = await supabase
      .from('lua_script_versions')
      .select('*')
      .eq('script_id', script.id)
      .order('version_number', { ascending: false });
    if (error) {
      toast({ title: 'Error', description: 'Gagal load history', variant: 'destructive' });
      return;
    }
    setVersions(data || []);
  };

  const restoreVersion = async (version: ScriptVersion) => {
    if (!historyScript) return;
    if (!confirm(`Restore versi #${version.version_number}? Versi saat ini akan disimpan ke history.`)) return;
    const { error } = await supabase.from('lua_scripts').update({
      content: version.content, updated_at: new Date().toISOString(),
    }).eq('id', historyScript.id);
    if (error) {
      toast({ title: 'Error', description: 'Gagal restore', variant: 'destructive' });
      return;
    }
    toast({ title: 'Berhasil', description: `Restored ke v${version.version_number}` });
    setHistoryScript(null);
    fetchScripts();
  };

  const undoToPrevious = async (script: UploadedScript) => {
    const { data } = await supabase
      .from('lua_script_versions')
      .select('*')
      .eq('script_id', script.id)
      .order('version_number', { ascending: false })
      .limit(1);
    if (!data || data.length === 0) {
      toast({ title: 'Tidak ada history', description: 'Belum ada versi sebelumnya' });
      return;
    }
    const prev = data[0];
    if (!confirm(`Undo ke versi #${prev.version_number} (${new Date(prev.created_at).toLocaleString('id-ID')})?`)) return;
    const { error } = await supabase.from('lua_scripts').update({
      content: prev.content, updated_at: new Date().toISOString(),
    }).eq('id', script.id);
    if (error) {
      toast({ title: 'Error', description: 'Gagal undo', variant: 'destructive' });
      return;
    }
    toast({ title: 'Undo berhasil', description: `Kembali ke v${prev.version_number}` });
    fetchScripts();
  };

  const getScriptUrl = (n: string) => `${SUPABASE_API_BASE}/get-script?name=${n}`;
  const copyUrl = (n: string) => { navigator.clipboard.writeText(getScriptUrl(n)); toast({ title: 'Copied!' }); };
  const copyLoadstring = (n: string) => {
    navigator.clipboard.writeText(`loadstring(game:HttpGet("${getScriptUrl(n)}"))()`);
    toast({ title: 'Copied!', description: 'Loadstring disalin' });
  };
  const copyIntegratedCode = (script: UploadedScript) => {
    navigator.clipboard.writeText(script.content || '');
    toast({ title: 'Copied!', description: 'Kode terintegrasi lengkap disalin' });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg sm:text-xl font-display font-semibold flex items-center gap-2">
            <Upload className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
            <span className="truncate">Upload Lua Scripts</span>
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Upload .lua — otomatis terintegrasi key system + whitelist database
          </p>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={reWrapAll} disabled={rewrapping || scripts.length === 0} title="Re-wrap semua dengan wrapper terbaru">
            <RotateCcw className={`w-4 h-4 ${rewrapping ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" size="sm" onClick={fetchScripts} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <Card className="glass-card">
        <CardContent className="p-4 sm:p-6">
          <input type="file" accept=".lua,.txt" ref={fileInputRef} onChange={handleUpload} className="hidden" />
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-primary/30 rounded-xl p-6 sm:p-8 text-center cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-all"
          >
            <Upload className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-3 text-primary/50" />
            <p className="text-sm font-medium mb-1">{uploading ? 'Uploading...' : 'Klik untuk upload file Lua'}</p>
            <p className="text-xs text-muted-foreground">File .lua atau .txt — auto-wrap key system + whitelist</p>
          </div>
          <div className="mt-3 p-2 rounded bg-primary/10 border border-primary/20">
            <div className="flex items-start gap-2 text-xs text-primary">
              <Shield className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span>Script otomatis cek <code className="text-[10px]">ArexansTools_Session.json</code> → kalau key valid langsung jalan, kalau tidak cek whitelist, kalau bukan whitelist minta input key.</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader className="pb-3 px-3 sm:px-6">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <FileCode className="w-4 h-4 text-primary" />
            Script Ter-upload ({scripts.length})
          </CardTitle>
          <CardDescription className="text-xs">
            Semua script terproteksi key system + whitelist · Undo / History tersedia per script
          </CardDescription>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          {scripts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileCode className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Belum ada script</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-3">
                {scripts.map((script) => (
                  <div key={script.id} className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm truncate">{script.display_name}</p>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            <Shield className="w-2.5 h-2.5 mr-0.5" />Key+WL
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{new Date(script.updated_at).toLocaleString('id-ID')}</p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => undoToPrevious(script)} title="Undo ke versi sebelumnya" className="h-8 px-2">
                          <Undo2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openHistory(script)} title="Lihat history" className="h-8 px-2">
                          <HistoryIcon className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteScript(script.id, script.display_name)} className="text-destructive hover:text-destructive h-8 px-2">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex gap-1.5">
                        <Input readOnly value={getScriptUrl(script.name)} className="font-mono text-[10px] h-7 bg-black/30" />
                        <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => copyUrl(script.name)}>
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => window.open(getScriptUrl(script.name), '_blank')}>
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </div>
                      <Button variant="outline" size="sm" className="w-full text-xs h-7" onClick={() => copyLoadstring(script.name)}>
                        <Copy className="w-3 h-3 mr-1" />
                        Copy Loadstring
                      </Button>
                      <Button variant="outline" size="sm" className="w-full text-xs h-7" onClick={() => copyIntegratedCode(script)}>
                        <FileCode className="w-3 h-3 mr-1" />
                        Copy Kode Terintegrasi Lengkap
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader className="pb-3 px-3 sm:px-6">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-yellow-500" />
            Fake Script API
          </CardTitle>
          <CardDescription className="text-xs">Endpoint fake source untuk user gagal autentikasi</CardDescription>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 space-y-2">
          <div className="flex gap-1.5">
            <Input readOnly value={`${SUPABASE_API_BASE}/get-fake-script`} className="font-mono text-xs bg-black/30" />
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(`${SUPABASE_API_BASE}/get-fake-script`); toast({ title: 'Copied!' }); }}>
              <Copy className="w-3 h-3" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* History dialog */}
      <Dialog open={!!historyScript} onOpenChange={(o) => { if (!o) { setHistoryScript(null); setPreviewVersion(null); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HistoryIcon className="w-4 h-4" />
              History: {historyScript?.display_name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Versi tersimpan otomatis tiap kali script diupdate (max 20 versi terakhir).
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-hidden flex-1">
            <ScrollArea className="border rounded p-2 max-h-[60vh]">
              {versions.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Belum ada versi tersimpan</p>
              ) : (
                <div className="space-y-1">
                  {versions.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setPreviewVersion(v)}
                      className={`w-full text-left p-2 rounded text-xs hover:bg-muted/50 transition ${previewVersion?.id === v.id ? 'bg-primary/10 border border-primary/30' : ''}`}
                    >
                      <div className="font-medium">Versi #{v.version_number}</div>
                      <div className="text-[10px] text-muted-foreground">{new Date(v.created_at).toLocaleString('id-ID')}</div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
            <div className="flex flex-col gap-2 overflow-hidden">
              {previewVersion ? (
                <>
                  <ScrollArea className="border rounded p-2 max-h-[50vh] bg-black/30">
                    <pre className="text-[10px] font-mono whitespace-pre-wrap break-all">{previewVersion.content.substring(0, 5000)}{previewVersion.content.length > 5000 ? '\n...(truncated)' : ''}</pre>
                  </ScrollArea>
                  <Button onClick={() => restoreVersion(previewVersion)} className="w-full">
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Restore versi #{previewVersion.version_number}
                  </Button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">Pilih versi untuk preview</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LuaUploadManager;
