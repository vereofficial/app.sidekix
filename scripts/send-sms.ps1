# Send a test SMS via Vonage Messages API (Basic auth) on Windows PowerShell.
# Do not commit secrets. Prefer env vars for the current session only.
#
# Session env vars (PowerShell — not "export"):
#   $env:VONAGE_API_KEY = 'your_api_key'
#   $env:VONAGE_API_SECRET = 'your_api_secret'
#   $env:SMS_TO = '14693887541'
#   $env:VONAGE_SMS_FROM = 'Vonage APIs'
#   .\scripts\send-sms.ps1
#
# Or pass parameters:
#   .\scripts\send-sms.ps1 -ApiKey '...' -ApiSecret '...' -To '14693887541'
#
# https://developer.vonage.com/en/messages/overview

[CmdletBinding()]
param(
    [string] $ApiKey = $env:VONAGE_API_KEY,
    [string] $ApiSecret = $env:VONAGE_API_SECRET,
    [string] $To = $env:SMS_TO,
    [string] $From = $(if ($env:VONAGE_SMS_FROM) { $env:VONAGE_SMS_FROM } else { 'Vonage APIs' }),
    [string] $Text = $(if ($env:SMS_BODY) { $env:SMS_BODY } else { 'This is an SMS text message sent using the Vonage Messages API.' })
)

if (-not $ApiKey) { throw 'Set $env:VONAGE_API_KEY or pass -ApiKey' }
if (-not $ApiSecret) { throw 'Set $env:VONAGE_API_SECRET or pass -ApiSecret' }
if (-not $To) { throw 'Set $env:SMS_TO or pass -To (E.164, e.g. 14693887541)' }

$bodyObj = @{
    to = $To
    from = $From
    channel = 'sms'
    message_type = 'text'
    text = $Text
}
$json = $bodyObj | ConvertTo-Json -Compress

$pair = "${ApiKey}:${ApiSecret}"
$bytes = [System.Text.Encoding]::ASCII.GetBytes($pair)
$basic = [Convert]::ToBase64String($bytes)

$uri = 'https://api.nexmo.com/v1/messages'
try {
    $response = Invoke-RestMethod -Uri $uri -Method Post -Body $json -ContentType 'application/json; charset=utf-8' -Headers @{
        Accept = 'application/json'
        Authorization = "Basic $basic"
    }
    $response | ConvertTo-Json -Depth 6
} catch {
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Error ($reader.ReadToEnd())
    }
    throw
}
