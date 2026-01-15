#!/bin/bash

# Gemini 文件服务器 - 一键安装脚本 (Patched for current directory install)
# 支持系统: Ubuntu / Debian

set -e

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then
  echo "❌ 请以 root 权限运行此脚本 (例如: sudo ./install.sh)"
  exit 1
fi

echo "🚀 开始安装 Gemini 文件服务器..."

# 1. 更新系统并安装 Nginx 和必要模块
echo "📦 更新软件包并安装 Nginx..."
apt-get update
apt-get install -y nginx nginx-extras

# 2. 准备目录
echo "📂 确认数据目录 /gemini ..."
# mkdir -p /gemini  <-- Already in /gemini

# 2.1 准备 SSL 证书
echo "🔒 检查 SSL 证书..."
mkdir -p /etc/nginx/ssl
if [ ! -f /etc/nginx/ssl/gemini.key ]; then
    echo "⚠️  未找到证书，正在生成自签名证书 (用于 HTTPS)..."
    # 如果 openssl 未安装，尝试安装
    if ! command -v openssl &> /dev/null; then
        apt-get install -y openssl
    fi
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
        -keyout /etc/nginx/ssl/gemini.key \
        -out /etc/nginx/ssl/gemini.crt \
        -subj "/C=CN/ST=Shanghai/L=Shanghai/O=Gemini/OU=Server/CN=_"
    echo "✅ 自签名证书已生成: /etc/nginx/ssl/gemini.crt"
else
    echo "✅ 检测到现有证书，跳过生成。"
fi

# 3. 部署配置文件
echo "⚙️ 部署 Nginx 配置..."
# 备份并禁用原有默认配置
if [ -f /etc/nginx/sites-enabled/default ]; then
    echo "⚠️  禁用默认 Nginx 站点..."
    mv /etc/nginx/sites-enabled/default /etc/nginx/default.site.bak
fi

# 复制配置文件
cp gemini_files.conf /etc/nginx/conf.d/

# 部署上传页面和 FancyIndex 模板
# cp upload.html /gemini/          <-- Skipped: Source and Dest are same
# cp fancyindex_header.html /gemini/ <-- Skipped
# cp fancyindex_footer.html /gemini/ <-- Skipped

# 4. 设置权限
echo "🔒 设置文件权限..."
chown -R www-data:www-data /gemini
chmod -R 775 /gemini

# 5. 测试并重启 Nginx
echo "🔄 重启 Nginx..."
nginx -t
if systemctl is-active --quiet nginx; then
    systemctl reload nginx
else
    # 尝试直接启动 (非 systemd 环境)
    service nginx start || nginx
fi

# 获取本机 IP (仅供参考)
IP=$(hostname -I | awk '{print $1}')

echo ""
echo "✅ 安装完成!"
echo "------------------------------------------------"
echo "📂 文件存储位置: /gemini"
echo "🌐 HTTP  访问: http://$IP:8084/"
echo "🔒 HTTPS 访问: https://$IP/"
echo "📤 上传页面: http://$IP:8084/upload.html"
echo "------------------------------------------------"
echo "注意: 请确保防火墙已放行 8084 和 443 端口。"
