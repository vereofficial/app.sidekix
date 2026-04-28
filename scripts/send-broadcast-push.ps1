# Send a broadcast push via Supabase Edge Function `broadcast-expo-push`.
# Prerequisites:
#   1. Deploy: npx supabase functions deploy broadcast-expo-push
#   2. Dashboard → Edge Functions → Secrets: set BROADCAST_PUSH_SECRET (long random string)
#
# Usage (PowerShell):
#   $env:SUPABASE_FUNCTION_URL = "https://YOUR_PROJECT_REF.supabase.co/functions/v1/broadcast-expo-push"
#   $env:BROADCAST_PUSH_SECRET = "your-secret"
#   .\scripts\send-broadcast-push.ps1

$ErrorActionPreference = "Stop"
if (-not $env:SUPABASE_FUNCTION_URL) { throw "Set SUPABASE_FUNCTION_URL" }
if (-not $env:BROADCAST_PUSH_SECRET) { throw "Set BROADCAST_PUSH_SECRET" }

$payload = @{
  title = "Sidekix"
  body  = "hey! 👋 there's a small bug blocking photo uploads right now. fix is on the way! we're running today's challenge back tomorrow so you don't miss it 📸"
} | ConvertTo-Json -Compress

Invoke-RestMethod -Uri $env:SUPABASE_FUNCTION_URL `
  -Method Post `
  -ContentType "application/json; charset=utf-8" `
  -Headers @{ Authorization = "Bearer $($env:BROADCAST_PUSH_SECRET)" } `
  -Body $payload
