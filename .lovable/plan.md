# Plan: Lua Manager Upgrade + VIP Animation Fix

## 1. Wrapper Keysystem + Whitelist (auto-integrasi saat upload)

Setiap file `.lua` yang diupload via `/developer` → Lua Upload Manager akan otomatis di-wrap dengan layer baru:

**Alur saat script di-execute oleh executor Roblox:**
```
1. Cek file: ArexansTools/ArexansTools_Session.json
   ├── Ada key tersimpan? → validasi ke /validate-key
   │     ├── Valid → langsung jalankan script (skip prompt)
   │     └── Invalid/expired → hapus file, lanjut step 2
   └── Tidak ada → lanjut step 2

2. Cek whitelist username (existing logic) ke /get-whitelist
   ├── Username terdaftar → jalankan + save key kosong sebagai marker
   └── Tidak terdaftar → lanjut step 3

3. Prompt input AXS key (via UI Library KeySystem)
   ├── Valid → simpan ke ArexansTools_Session.json + jalankan
   └── Invalid → loadFakeScript()
```

File yang diubah:
- `src/components/LuaUploadManager.tsx` — update `WHITELIST_WRAPPER` jadi `PROTECTION_WRAPPER` dengan logic di atas
- Tambah tombol "Re-wrap semua script" untuk apply wrapper baru ke script lama tanpa upload ulang

## 2. Sistem Versi (Undo / Redo per Script)

**Database (migration baru):**
```
Table: lua_script_versions
  - script_id (FK → lua_scripts.id, cascade delete)
  - version_number (auto-increment per script_id)
  - content (text)
  - created_at
```

**Trigger:** sebelum UPDATE pada `lua_scripts.content` → simpan versi lama ke `lua_script_versions`. Limit 20 versi terakhir per script (auto-delete oldest).

**UI di LuaUploadManager:**
- Tiap card script → tombol "History" buka dialog list versi
- Tombol "← Undo" / "Redo →" di setiap card untuk navigate ke versi sebelum/sesudah
- Preview content + tombol "Restore versi ini"

## 3. Fix Animasi VIP di Main Lua

**Masalah:** Saat VIP animation aktif di game yang sudah punya `Humanoid.Animator` custom (mis. game battle dengan animasi sendiri), karakter bug menyeret seperti patung karena dua animator berbenturan.

**Fix di main lua (`main` script di DB):**

Tambahkan auto-detection sebelum apply VIP animation:
```lua
local function hasCustomAnimations(character)
    local humanoid = character:FindFirstChildOfClass("Humanoid")
    if not humanoid then return false end
    local animator = humanoid:FindFirstChildOfClass("Animator")
    if not animator then return false end
    -- Cek apakah ada Animation tracks yang sedang play dari game
    for _, track in ipairs(animator:GetPlayingAnimationTracks()) do
        if track.Animation and not track.Animation:GetAttribute("ArexansVIP") then
            return true
        end
    end
    -- Cek apakah ada script Animate di character (default Roblox + custom override)
    local animate = character:FindFirstChild("Animate")
    if animate and animate:IsA("LocalScript") and animate.Disabled == false then
        -- Cek attribute custom (game biasanya rename atau modify)
        for _, child in ipairs(animate:GetChildren()) do
            if child:IsA("StringValue") or child:IsA("Animation") then
                local id = child:IsA("Animation") and child.AnimationId or (child:FindFirstChildOfClass("Animation") and child:FindFirstChildOfClass("Animation").AnimationId or "")
                -- Jika AnimationId bukan default Roblox (rbxassetid yang dikenal), berarti custom
                if id ~= "" and not string.find(id, "507766388") and not string.find(id, "507767714") then
                    return true
                end
            end
        end
    end
    return false
end

-- Sebelum apply VIP animation:
if hasCustomAnimations(character) then
    warn("[ArexansVIP] Game has custom animations, VIP animation disabled to prevent conflict")
    disableVipAnimation()
    return
end
-- Tag animation kita biar tidak dianggap "custom" di check berikutnya:
vipAnimTrack.Animation:SetAttribute("ArexansVIP", true)
```

Plus listener `CharacterAdded` re-run detection setiap respawn / ganti game.

**Catatan:** main script 479KB — saya akan cari blok "VIP animation" / loadAnimation / Animator dan inject helper + guard. Jika nama fungsi VIP berbeda, saya akan grep dulu dan adjust.

## Urutan eksekusi
1. Migration `lua_script_versions` + trigger
2. Update `LuaUploadManager.tsx` (wrapper baru + UI undo/redo + history dialog)
3. Patch main lua content via SQL update (inject hasCustomAnimations guard)
4. Test: upload script dummy, cek session.json flow, cek undo/redo, deploy

## Konfirmasi yang dibutuhkan
- OK untuk membuat tabel `lua_script_versions` (max 20 versi/script)?
- Saat saya patch main lua, apakah saya boleh menambah ~50 baris helper di awal block VIP animation? (tidak akan menghapus fitur lain)
- Session file path: `ArexansTools/ArexansTools_Session.json` — apakah ini relatif ke `workspace` executor (writefile API) atau path lain?
