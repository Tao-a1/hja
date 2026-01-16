
// 1. 代理服务器配置
const CONFIG = {
    mode: "fixed_servers",
    rules: {
        singleProxy: {
            scheme: "https",
            host: "vpn.lytide.asia",
            port: 8083
        },
        bypassList: ["localhost", "127.0.0.1", "::1", "baidu.com", "vpn.lytide.asia"] 
    }
};

// 2. 混淆存储的凭据 (Base64: myuser:mypass123)
const ENCRYPTED_CRED = "bXl1c2VyOm15cGFzczEyMw==";

// 自定义 Base64 解码，确保在 Service Worker 中绝对可用
function safeDecode(str) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    str = String(str).replace(/=+$/, '');
    for (let bc = 0, bs = 0, buffer, i = 0; buffer = str.charAt(i++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
        buffer = chars.indexOf(buffer);
    }
    return output;
}

function getCredentials() {
    try {
        const decoded = safeDecode(ENCRYPTED_CRED);
        const parts = decoded.split(':');
        if (parts.length >= 2) {
            return { username: parts[0], password: parts.slice(1).join(':') };
        }
    } catch (e) {
        console.error("Critical: Credential decode failed", e);
    }
    // Fallback (failsafe)
    return { username: "myuser", password: "mypass123" };
}

// 3. 初始化
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ enabled: false });
    updateIcon(false);
});

chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.get(['enabled'], (result) => {
        if (result.enabled) enableProxy();
        else disableProxy();
    });
});

// 4. 消息处理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.command === "toggle_proxy") {
        if (message.enable) enableProxy();
        else disableProxy();
        sendResponse({status: "done"});
    } else if (message.command === "get_status") {
        chrome.storage.local.get(['enabled'], (result) => {
            sendResponse({enabled: !!result.enabled});
        });
        return true;
    }
});

function enableProxy() {
    chrome.proxy.settings.set(
        {value: CONFIG, scope: "regular"},
        () => {
            console.log("Proxy ENABLED: HTTPS 8083");
            chrome.storage.local.set({ enabled: true });
            updateIcon(true);
        }
    );
}

function disableProxy() {
    chrome.proxy.settings.set(
        {value: {mode: "direct"}, scope: "regular"},
        () => {
            console.log("Proxy DISABLED");
            chrome.storage.local.set({ enabled: false });
            updateIcon(false);
        }
    );
}

function updateIcon(enabled) {
    const text = enabled ? "ON" : "OFF";
    const color = enabled ? "#4CAF50" : "#999999";
    chrome.action.setBadgeText({text: text});
    chrome.action.setBadgeBackgroundColor({color: color});
}

// 5. 自动填充密码 (核心修复)
chrome.webRequest.onAuthRequired.addListener(
    (details) => {
        // 仅在代理认证时触发，防止干扰普通网站认证
        if (details.isProxy === true) {
            console.log("Providing proxy credentials...");
            return { authCredentials: getCredentials() };
        }
        // 如果不是代理认证，不处理 (return undefined)
    },
    {urls: ["<all_urls>"]},
    ["blocking"]
);

// 错误日志
chrome.proxy.onProxyError.addListener((details) => {
    console.error("Proxy Error:", details);
});
