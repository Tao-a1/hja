#!/bin/bash
set -e

# ================= 配置区域 =================
DOMAIN="vpn.lytide.asia"
PROXY_USER="myuser"       # ⚠️ 请修改此处用户名
PROXY_PASS="mypass123"    # ⚠️ 请修改此处密码
# ===========================================

# 检查是否以 root 运行
if [ "$EUID" -ne 0 ]; then
  echo "请以 root 权限运行此脚本 (sudo ./setup.sh)"
  exit 1
fi

echo ">>> 1. 更新系统并安装必要工具..."
apt-get update -y
apt-get install -y curl debian-keyring debian-archive-keyring apt-transport-https

echo ">>> 2. 下载集成 forward_proxy 插件的 Caddy (AMD64)..."
# 使用 Caddy 官方构建 API 下载集成插件的版本
# 插件地址: github.com/caddyserver/forwardproxy
DOWNLOAD_URL="https://caddyserver.com/api/download?os=linux&arch=amd64&p=github.com%2Fcaddyserver%2Fforwardproxy"

curl -L -o /usr/bin/caddy "$DOWNLOAD_URL"
chmod +x /usr/bin/caddy

# 验证版本
echo "Caddy 版本:"
/usr/bin/caddy version

echo ">>> 3. 创建 Caddy 用户和目录..."
# 创建专属用户以提高安全性
if ! id "caddy" &>/dev/null; then
    groupadd --system caddy
    useradd --system \
        --gid caddy \
        --create-home \
        --home-dir /var/lib/caddy \
        --shell /usr/sbin/nologin \
        --comment "Caddy web server" \
        caddy
fi

mkdir -p /etc/caddy
chown -R caddy:caddy /etc/caddy
chown -R caddy:caddy /var/lib/caddy

echo ">>> 4. 生成 Caddyfile 配置..."
cat > /etc/caddy/Caddyfile <<EOF
${DOMAIN} {
    #配置 HTTPS 代理
    forward_proxy {
        basic_auth ${PROXY_USER} ${PROXY_PASS}
        hide_ip
        hide_via
    }

    #伪装页面：当直接访问域名或没有提供代理凭证时显示
    #您也可以将其改为 'file_server' 来展示静态网站
    respond "Hello! System is running normally." 200
}
EOF

echo ">>> 5. 配置 Systemd 服务..."
cat > /etc/systemd/system/caddy.service <<EOF
[Unit]
Description=Caddy
Documentation=https://caddyserver.com/docs/
After=network.target network-online.target
Requires=network-online.target

[Service]
Type=notify
User=caddy
Group=caddy
ExecStart=/usr/bin/caddy run --environ --config /etc/caddy/Caddyfile
ExecReload=/usr/bin/caddy reload --config /etc/caddy/Caddyfile
TimeoutStopSec=5s
LimitNOFILE=1048576
LimitNPROC=512
PrivateTmp=true
ProtectSystem=full
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
EOF

echo ">>> 6. 启动服务..."
systemctl daemon-reload
systemctl enable caddy
systemctl restart caddy

echo "=================================================="
echo "部署完成！"
echo "域名: ${DOMAIN}"
echo "用户名: ${PROXY_USER}"
echo "密码: ${PROXY_PASS}"
echo "--------------------------------------------------"
echo "查看状态: systemctl status caddy"
echo "查看日志: journalctl -u caddy -f"
echo "=================================================="
