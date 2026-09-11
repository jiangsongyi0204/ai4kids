# ============================================================
#  本地用 HTTPS 跑开发服务器（自签证书，只给本机测试用）
#
#  用法：
#      npm run dev:https
#
#  之后：
#      https://localhost/        正常打开（浏览器会提示证书不受信任 → 高级 → 继续访问）
#      http://localhost/         301 跳转到 https://localhost/
#
#  想换端口（比如 443 被占用）：
#      $env:HTTPS_PORT=8443; npm run dev:https
#
#  证书生成在 .certs/（已 gitignore），删掉重跑会自动重新生成。
#  线上服务器不用这个脚本，走 deploy/setup-https.sh 签 Let's Encrypt 证书。
#
#  想彻底免掉浏览器的「证书不受信任」警告（可选）：
#      装 mkcert 后执行  mkcert -install ; mkcert localhost 127.0.0.1
#      它会把生成的 localhost+1.pem / localhost+1-key.pem 改名为
#      fullchain.pem / privkey.pem 放进 .certs/ 即可（本脚本会自动沿用，不再重新生成）。
# ============================================================
$ErrorActionPreference = 'Stop'

$root  = Split-Path -Parent $PSScriptRoot
$certs = Join-Path $root '.certs'
$key   = Join-Path $certs 'privkey.pem'
$crt   = Join-Path $certs 'fullchain.pem'
$acme  = Join-Path $certs 'acme'

if (-not (Test-Path $key) -or -not (Test-Path $crt)) {
    # Git for Windows 自带 openssl，按常见路径找一下
    $openssl = @(
        'C:\Program Files\Git\usr\bin\openssl.exe',
        'C:\Program Files\Git\mingw64\bin\openssl.exe',
        'C:\Program Files\OpenSSL-Win64\bin\openssl.exe'
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1

    if (-not $openssl) {
        Write-Host "❌ 没找到 openssl。" -ForegroundColor Red
        Write-Host "   装个 Git for Windows 就有了；或手动把 privkey.pem / fullchain.pem 放到：$certs"
        exit 1
    }

    New-Item -ItemType Directory -Force -Path $certs | Out-Null
    Write-Host "🔐 生成自签证书（localhost，2 年有效）→ $certs"
    # openssl 把进度打到 stderr；PS 5.1 在 ErrorActionPreference='Stop' 下会把它当错误抛出，
    # 所以这里临时放宽、自己收集输出，只在真的失败时才打印
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $osslOut = & $openssl req -x509 -newkey rsa:2048 -nodes -days 730 `
        -keyout $key -out $crt `
        -subj '/CN=localhost' `
        -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1' 2>&1
    $osslCode = $LASTEXITCODE
    $ErrorActionPreference = $prevEap
    if ($osslCode -ne 0) {
        Write-Host "❌ openssl 生成证书失败：" -ForegroundColor Red
        $osslOut | ForEach-Object { Write-Host "   $_" }
        exit 1
    }
}

New-Item -ItemType Directory -Force -Path $acme | Out-Null

# 没有显式指定就用默认值（443 在 Windows 上不需要管理员权限）
if (-not $env:PORT)       { $env:PORT = '80' }
if (-not $env:HTTPS_PORT) { $env:HTTPS_PORT = '443' }
$env:TLS_DIR      = $certs
$env:ACME_WEBROOT = $acme

Write-Host ""
Write-Host "🚀 启动开发服务器（HTTP :$($env:PORT) + HTTPS :$($env:HTTPS_PORT)）"
Write-Host "   https://localhost:$($env:HTTPS_PORT)/   ← 浏览器提示证书不受信任时选「高级 → 继续访问」"
Write-Host "   http://localhost:$($env:PORT)/    会 301 跳转到上面"
Write-Host "   （想免掉警告可以装 mkcert，见本文件顶部注释；线上是 Let's Encrypt 正式证书，不会有警告）"
Write-Host ""

Set-Location $root
npm run dev
