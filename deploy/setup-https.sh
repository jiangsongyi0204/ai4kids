#!/usr/bin/env bash
# ============================================================
#  ai4kids · 一次性开通 HTTPS（只用 Node.js，不用 Nginx）
#  覆盖域名：ai4kids.online / www.ai4kids.online
#
#  在 ECS 上执行（需要 root）：
#      cd /root/projects/ai4kids
#      bash deploy/setup-https.sh 你的邮箱@example.com
#
#  原理：Express 自己同时监听 80 与 443
#    · 80 端口负责 certbot 的 HTTP-01 验证（/.well-known/acme-challenge），
#      其余请求一律 301 跳到 HTTPS
#    · 证书签好后再重启一次，Node 就会在 443 上启动 HTTPS
#  所以整个过程不需要 Nginx，也不会切换端口（全程都在 80 上，几乎无中断）。
# ============================================================
set -euo pipefail

DOMAIN="ai4kids.online"
WWW_DOMAIN="www.ai4kids.online"
CERT_LIVE="/etc/letsencrypt/live/${DOMAIN}"
WEBROOT="/var/www/certbot"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

EMAIL="${1:-}"
if [ -z "$EMAIL" ]; then
  echo "❌ 缺少邮箱参数（Let's Encrypt 用来发证书到期提醒）"
  echo "   用法： bash deploy/setup-https.sh 你的邮箱@example.com"
  exit 1
fi

if [ "$(id -u)" != "0" ]; then
  echo "❌ 请用 root 执行（sudo bash deploy/setup-https.sh 邮箱）"
  echo "   绑定 80/443 需要 root 权限"
  exit 1
fi

if [ ! -f "$REPO_DIR/ecosystem.config.js" ]; then
  echo "❌ 找不到 $REPO_DIR/ecosystem.config.js —— 请在仓库根目录执行本脚本"
  exit 1
fi

echo "==> 0/8 检查 DNS 解析"
SERVER_IP="$(curl -s --max-time 8 https://api.ipify.org || echo '')"
echo "    本机公网 IP : ${SERVER_IP:-未知}"
for d in "$DOMAIN" "$WWW_DOMAIN"; do
  if command -v getent >/dev/null; then
    resolved="$(getent hosts "$d" | awk '{print $1}' | head -1 || true)"
    echo "    $d -> ${resolved:-未解析}"
    if [ -n "$SERVER_IP" ] && [ -n "${resolved:-}" ] && [ "$resolved" != "$SERVER_IP" ]; then
      echo "    ⚠️  $d 没指向本机，证书申请会失败（HTTP-01 验证走不通）"
    fi
  fi
done

echo "==> 1/8 安装 certbot"
if command -v apt-get >/dev/null; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq certbot curl
elif command -v dnf >/dev/null; then
  dnf install -y epel-release || true      # RHEL 系 certbot 在 EPEL 里
  dnf install -y certbot curl
elif command -v yum >/dev/null; then
  yum install -y epel-release || true
  yum install -y certbot curl
else
  echo "❌ 未识别的包管理器，请手动安装 certbot"; exit 1
fi
mkdir -p "$WEBROOT"

echo "==> 2/8 让 Node 以生产配置运行（监听 80，此刻还没证书 → 只有 HTTP）"
cd "$REPO_DIR"
if ! command -v pm2 >/dev/null; then
  echo "❌ 未找到 pm2，请先安装：npm i -g pm2"; exit 1
fi
pm2 startOrRestart ecosystem.config.js --update-env
pm2 save || true
sleep 2

echo "==> 3/8 通过 80 端口验证站点与 ACME 路径"
if curl -fsS -o /dev/null --max-time 10 "http://127.0.0.1/" ; then
  echo "    ✅ 本机 http://127.0.0.1/ 正常"
else
  echo "    ❌ 本机 80 端口无响应，请先看 pm2 logs ai4kids"; exit 1
fi
# 放一个探针文件，确认 ACME 路径确实由 Node 提供
echo "ai4kids-acme-ok" > "$WEBROOT/ping.txt"
if curl -fsS --max-time 10 "http://127.0.0.1/.well-known/acme-challenge/ping.txt" | grep -q "ai4kids-acme-ok"; then
  echo "    ✅ ACME 验证路径通畅"
else
  echo "    ❌ /.well-known/acme-challenge/ 未正确响应，certbot 会失败（检查 server.ts 里是否注册了该静态目录）"; exit 1
fi

echo "==> 4/8 申请 Let's Encrypt 证书（$DOMAIN + $WWW_DOMAIN）"
certbot certonly \
  --webroot -w "$WEBROOT" \
  -d "$DOMAIN" -d "$WWW_DOMAIN" \
  --non-interactive --agree-tos --keep-until-expiring \
  -m "$EMAIL"

echo "==> 5/8 重启 Node，让 443 上的 HTTPS 生效"
pm2 restart ai4kids --update-env || pm2 startOrRestart ecosystem.config.js --update-env
pm2 save || true
sleep 3

echo "==> 6/8 验证 HTTPS"
if curl -fsS -o /dev/null --max-time 10 --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/" ; then
  echo "    ✅ https://${DOMAIN}/ 正常"
else
  echo "    ⚠️  本机 HTTPS 校验失败，请看 pm2 logs ai4kids（证书路径：${CERT_LIVE}）"
fi
code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -H 'Host: '"$DOMAIN" "http://127.0.0.1/" || echo '000')"
echo "    HTTP 跳转状态码：$code （期望 301）"

echo "==> 7/8 配好续期后自动重启 Node"
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/restart-ai4kids.sh <<'HOOK'
#!/usr/bin/env bash
# 证书续期后重启 Node，让它加载新证书
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"
command -v pm2 >/dev/null 2>&1 && pm2 restart ai4kids || true
HOOK
chmod +x /etc/letsencrypt/renewal-hooks/deploy/restart-ai4kids.sh
# 续期定时器名字各发行版不同：Debian/Ubuntu 是 certbot.timer，RHEL 系是 certbot-renew.timer
systemctl enable --now certbot.timer >/dev/null 2>&1 \
  || systemctl enable --now certbot-renew.timer >/dev/null 2>&1 \
  || echo "    ⚠️  没找到 certbot 续期定时器，请确认已安装（Debian: certbot.timer / RHEL: certbot-renew.timer）"

echo "==> 8/8 放行防火墙端口（若启用了 firewalld/ufw）"
if command -v firewall-cmd >/dev/null && systemctl is-active --quiet firewalld; then
  firewall-cmd --permanent --add-service=http  >/dev/null || true
  firewall-cmd --permanent --add-service=https >/dev/null || true
  firewall-cmd --reload >/dev/null || true
  echo "    firewalld 已放行 80/443"
elif command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 80/tcp  >/dev/null || true
  ufw allow 443/tcp >/dev/null || true
  echo "    ufw 已放行 80/443"
else
  echo "    未检测到启用的本机防火墙，跳过"
fi
rm -f "$WEBROOT/ping.txt"

echo
echo "============================================================"
echo " 🎉 完成！现在应该可以访问："
echo "      https://${DOMAIN}/"
echo "      https://${WWW_DOMAIN}/"
echo
echo " 别忘了确认这两件事，否则外部仍然访问不到："
echo "   1) 阿里云控制台「安全组」放行 80 与 443 端口"
echo "   2) 域名解析 A 记录已指向本机，且域名已完成 ICP 备案"
echo "      （大陆节点 + 未备案域名会被拦截）"
echo
echo " 证书续期：certbot 自动续期，续期后自动重启 Node 加载新证书"
echo " 手动检查：certbot renew --dry-run"
echo "============================================================"
