# Build iOS for App Store with Apple capability sync disabled on the *local* machine.
# eas.json "env" applies to Expo's cloud builder; the CLI still talks to Apple from your PC unless this is set.
#
# Usage:
#   .\scripts\eas-ios-production-build.ps1
#   .\scripts\eas-ios-production-build.ps1 --non-interactive

param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $Passthrough
)

$env:EXPO_NO_CAPABILITY_SYNC = "1"
$env:EAS_BUILD_NO_EXPO_GO_WARNING = "true"

if ($Passthrough -and $Passthrough.Count -gt 0) {
  & npx eas build --platform ios --profile production @Passthrough
} else {
  & npx eas build --platform ios --profile production
}
