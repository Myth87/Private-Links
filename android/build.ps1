param(
    [string]$Sdk = "$env:LOCALAPPDATA/Android/Sdk",
    [string]$BuildTools = '36.0.0',
    [string]$Jdk = $env:JAVA_HOME,
    [string]$BundleTool
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$root = Split-Path $PSScriptRoot -Parent
$tools = Join-Path $Sdk "build-tools/$BuildTools"
$platform = Join-Path $Sdk 'platforms/android-36/android.jar'
$build = Join-Path $PSScriptRoot 'build'
$web = Join-Path $root 'web/dist'
$assets = Join-Path $build 'assets'
if ($Jdk) {
    $env:JAVA_HOME = $Jdk
    $env:Path = "$Jdk/bin;$env:Path"
}

function Invoke-BuildTool($Program, [string[]]$Arguments) {
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program exited with code $LASTEXITCODE" }
}

New-Item -ItemType Directory -Force $assets, "$build/classes", "$build/res/drawable-nodpi" | Out-Null
foreach ($filename in @('index.html', 'style.css', 'app.js', 'languages.js', 'cleaner.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png')) {
    Copy-Item (Join-Path $web $filename) $assets -Force
}
Copy-Item "$assets/icon-192.png" "$build/res/drawable-nodpi/icon.png" -Force

Invoke-BuildTool "$tools/aapt2.exe" @('compile', '--dir', "$build/res", '-o', "$build/res.zip")
Invoke-BuildTool "$tools/aapt2.exe" @('link', '-I', $platform,
    '--manifest', "$PSScriptRoot/AndroidManifest.xml", '-A', $assets,
    '-o', "$build/resources.apk", "$build/res.zip")

$sources = (Get-ChildItem "$PSScriptRoot/src" -Filter '*.java').FullName
Invoke-BuildTool 'javac' (@('--release', '8', '-classpath', $platform, '-d', "$build/classes") + $sources)
$classes = (Get-ChildItem "$build/classes" -Filter '*.class' -Recurse).FullName
Invoke-BuildTool "$tools/d8.bat" (@('--min-api', '24', '--lib', $platform, '--output', $build) + $classes)

Push-Location $build
try {
    Invoke-BuildTool 'jar' @('uf', 'resources.apk', 'classes.dex')
} finally {
    Pop-Location
}
Invoke-BuildTool "$tools/zipalign.exe" @('-f', '4', "$build/resources.apk", "$build/aligned.apk")
if (-not (Test-Path "$build/debug.jks")) {
    Invoke-BuildTool 'keytool' @('-genkeypair', '-keystore', "$build/debug.jks",
        '-storepass', 'android', '-keypass', 'android', '-alias', 'androiddebugkey',
        '-dname', 'CN=Android Debug,O=Android,C=US', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000')
}
Invoke-BuildTool "$tools/apksigner.bat" @('sign', '--ks', "$build/debug.jks", '--ks-pass', 'pass:android',
    '--out', "$build/Private-Links.apk", "$build/aligned.apk")
Invoke-BuildTool "$tools/apksigner.bat" @('verify', '--verbose', "$build/Private-Links.apk")
Write-Output "APK created at $build/Private-Links.apk"

if ($BundleTool) {
    $bundleToolPath = (Resolve-Path -LiteralPath $BundleTool).Path
    Invoke-BuildTool "$tools/aapt2.exe" @('link', '--proto-format', '-I', $platform,
        '--manifest', "$PSScriptRoot/AndroidManifest.xml", '-A', $assets,
        '-o', "$build/base-resources.zip", "$build/res.zip")
    $bundleModule = Join-Path $build ("bundle-module-" + [guid]::NewGuid())
    New-Item -ItemType Directory -Path "$bundleModule/manifest", "$bundleModule/dex" | Out-Null
    Expand-Archive -LiteralPath "$build/base-resources.zip" -DestinationPath $bundleModule
    Move-Item -LiteralPath "$bundleModule/AndroidManifest.xml" -Destination "$bundleModule/manifest/AndroidManifest.xml"
    Copy-Item -LiteralPath "$build/classes.dex" -Destination "$bundleModule/dex/classes.dex"
    Invoke-BuildTool 'jar' @('cfM', "$build/base.zip", '-C', $bundleModule, '.')
    $bundle = "$build/Private-Links-unsigned.aab"
    Invoke-BuildTool 'java' @('-jar', $bundleToolPath, 'build-bundle',
        "--modules=$build/base.zip", "--output=$bundle", '--overwrite')
    Invoke-BuildTool 'java' @('-jar', $bundleToolPath, 'validate', "--bundle=$bundle")
    Write-Output "Unsigned Play bundle created at $bundle"
}
