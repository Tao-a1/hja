const https = require('https');
const http = require('http'); // Used for http.request for upstream
const net = require('net');
const url = require('url');
const fs = require('fs');

const PORT = 8083;
const USERNAME = 'myuser';
const PASSWORD = 'mypass123';
const AUTH_STRING = 'Basic ' + Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');

// Load SSL Certs
const options = {
  key: fs.readFileSync('/etc/letsencrypt/live/vpn.lytide.asia/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/vpn.lytide.asia/fullchain.pem')
};

// 验证函数
function checkAuth(req, socket) {
    const authHeader = req.headers['proxy-authorization'];
    if (!authHeader || authHeader !== AUTH_STRING) {
        if (socket) {
            // For CONNECT requests
            socket.write('HTTP/1.1 407 Proxy Authentication Required\r\n');
            socket.write('Proxy-Authenticate: Basic realm="Proxy"\r\n');
            socket.write('\r\n');
            socket.end();
        } else {
            // For standard requests
            return false;
        }
        return false;
    }
    return true;
}

const server = https.createServer(options, (req, res) => {
    // 1. 验证
    if (!checkAuth(req)) {
        res.writeHead(407, { 'Proxy-Authenticate': 'Basic realm="Proxy"' });
        res.end('Proxy Authentication Required');
        return;
    }

    // 2. 解析请求
    // 注意：HTTPS 代理收到的请求 url 通常是相对路径 (/foo) 或完整 url
    // 但作为 Secure Web Proxy，客户端发送的通常是完整 URL
    let requestUrl = req.url;
    // 如果 url 不包含 host (虽然标准代理请求应该包含)，我们需要处理
    if (!requestUrl.startsWith('http')) {
        // 这通常不会发生在正规代理请求中，除非客户端只发了path
        // 这里无法猜测 protocol/host，除非看 Host 头
        requestUrl = 'http://' + req.headers.host + req.url;
    }
    
    const parsedUrl = url.parse(requestUrl);
    
    // 代理请求选项
    const proxyOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 80,
        path: parsedUrl.path,
        method: req.method,
        headers: req.headers
    };

    // 删除代理特有的头
    delete proxyOptions.headers['proxy-authorization'];
    delete proxyOptions.headers['proxy-connection'];

    // 3. 发起请求 (使用 http 或 https 发给上游)
    // 简单起见，这里假设上游全是 http (如果是 https 网站，客户端会用 CONNECT)
    // 如果客户端通过 GET https://... 请求，则需要用 https 模块
    // 但 Secure Web Proxy 对 HTTPS 网站也是走 CONNECT。
    
    const proxyReq = http.request(proxyOptions, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (err) => {
        console.error(`Request Error (${req.url}):`, err.message);
        if (!res.headersSent) {
            res.writeHead(502);
            res.end('Bad Gateway');
        }
    });

    req.pipe(proxyReq, { end: true });
});

// 处理 CONNECT (用于 HTTPS 网站隧道)
server.on('connect', (req, clientSocket, head) => {
    // 1. 验证
    if (!checkAuth(req, clientSocket)) {
        return;
    }

    // 2. 解析目标
    // req.url 应该是 "www.google.com:443"
    let target = req.url;
    let hostname, port;

    if (target.includes(':')) {
        const parts = target.split(':');
        hostname = parts[0];
        port = parts[1];
    } else {
        hostname = target;
        port = 443;
    }

    // 3. 建立 TCP 连接
    const serverSocket = net.connect(port, hostname, () => {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        serverSocket.write(head);
        serverSocket.pipe(clientSocket);
        clientSocket.pipe(serverSocket);
    });

    serverSocket.on('error', (err) => {
        console.error(`Connect Error (${req.url}):`, err.message);
        try {
            clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
        } catch (e) {}
    });

    clientSocket.on('error', (err) => {
         // Client closed
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Node.js HTTPS Proxy Server running on port ${PORT}`);
    console.log(`Auth: ${USERNAME} / ${PASSWORD}`);
    console.log(`Domain: vpn.lytide.asia`);
});