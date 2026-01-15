# Gemini 文件服务器安装包

这是一个基于 Nginx 的轻量级文件服务器安装包，支持文件下载和上传 (WebDAV)。

## 包含内容
- Nginx 配置文件 (端口 8084)
- 简单的 Web 上传页面
- 自动化安装脚本

## 如何使用

1. 解压此压缩包：
   ```bash
   unzip gemini-file-server-installer.zip
   cd gemini-file-server-installer
   ```

2. 运行安装脚本 (需要 root 权限)：
   ```bash
   sudo chmod +x install.sh
   sudo ./install.sh
   ```

3. 安装完成后：
   - 访问 `http://<服务器IP>:8084/` 查看和下载文件。
   - 访问 `http://<服务器IP>:8084/upload.html` 上传文件。

## 注意事项
- 此配置默认使用 HTTP 协议，适合内部网络或有前置负载均衡器（处理 HTTPS）的环境。
- 默认没有设置上传密码。如果是公开网络，建议修改 `/etc/nginx/conf.d/gemini_files.conf` 添加 WebDAV 认证。
- 确保您的服务器防火墙已放行 8084 端口。
