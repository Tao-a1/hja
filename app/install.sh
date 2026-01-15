#!/bin/bash

# Gemini 文件服务器 - 一键安装脚本
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
echo "📂 创建数据目录 /gemini ..."
mkdir -p /gemini/app

# ... (SSL 部分保持不变) ...

# 3. 部署配置文件
echo "⚙️ 部署 Nginx 配置..."
# ... (备份部分保持不变) ...

# 复制配置文件
# 假设安装包解压后就在当前目录，文件都在 app/ 下 (或者当前就是 app/)
# 这里我们需要根据实际打包方式调整。假设用户 clone 了 repo，结构是 /repo/app/...
# 为了兼容性，我们直接从脚本所在目录复制
SCRIPT_DIR=$(dirname "$(readlink -f "$0")")
cp "$SCRIPT_DIR/gemini_files.conf" /etc/nginx/conf.d/

# 部署静态文件
cp -r "$SCRIPT_DIR/"* /gemini/app/
# 修正权限 (确保 www-data 能读取 app 目录)


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
echo "🌐 HTTP  访问: http://$IP:8082/"
echo "🔒 HTTPS 访问: https://$IP/"
echo "📤 上传页面: http://$IP:8082/upload.html"
echo "------------------------------------------------"
echo "注意: 请确保防火墙已放行 8084 和 443 端口。"
