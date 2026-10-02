param(
    [string]$Project = $(if ($env:GCP_PROJECT) { $env:GCP_PROJECT } else { "partyline-phone-system" }),
    [string]$Service = $(if ($env:CLOUD_RUN_SERVICE) { $env:CLOUD_RUN_SERVICE } else { "partyline-api" }),
    [string]$AllowedOrigins = $(if ($env:ALLOWED_ORIGINS) { $env:ALLOWED_ORIGINS } else { "https://partyline.lucasbacchi.com,http://localhost:5173" })
)

$ErrorActionPreference = "Stop"
$Region = "us-east1"

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    throw "gcloud CLI was not found. Install the Google Cloud CLI and run gcloud auth login first."
}

$backendPath = (Resolve-Path $PSScriptRoot).Path

Write-Host "Deploying $Service to Cloud Run in $Region ($Project)..."
Push-Location $backendPath
try {
    gcloud run deploy $Service `
        --source . `
        --project $Project `
        --region $Region `
        --platform managed `
        --allow-unauthenticated `
        --set-env-vars "^||^ALLOWED_ORIGINS=$AllowedOrigins"
} finally {
    Pop-Location
}