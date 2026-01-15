
const CONFIG = {
    mode: "fixed_servers",
    rules: {
        singleProxy: {
            scheme: "http",
            host: "vpn.lytide.asia",
            port: 8083
        },
        bypassList: ["localhost", "127.0.0.1", "::1", "baidu.com", "vpn.lytide.asia"] 
    }
};

const CREDENTIALS = {
    username: "myuser",
    password: "mypass123"
};

let isProxyOn = false;

console.log("Service Worker Started. Config:", JSON.stringify(CONFIG));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.command === "toggle_proxy") {
        if (message.enable) {
            enableProxy();
        } else {
            disableProxy();
        }
        sendResponse({status: "done"});
    } else if (message.command === "get_status") {
        sendResponse({enabled: isProxyOn});
    }
});

function enableProxy() {
    chrome.proxy.settings.set(
        {value: CONFIG, scope: "regular"},
        () => {
            console.log("Proxy ENABLED: vpn.lytide.asia:8083 (HTTP)");
            isProxyOn = true;
            updateIcon(true);
        }
    );
}

function disableProxy() {
    chrome.proxy.settings.set(
        {value: {mode: "direct"}, scope: "regular"},
        () => {
            console.log("Proxy DISABLED");
            isProxyOn = false;
            updateIcon(false);
        }
    );
}

function updateIcon(enabled) {
    const text = enabled ? "ON" : "OFF";
    const color = enabled ? "#FF5722" : "#999999";
    chrome.action.setBadgeText({text: text});
    chrome.action.setBadgeBackgroundColor({color: color});
}

chrome.webRequest.onAuthRequired.addListener(
    (details) => {
        console.log("Auth required for:", details.url);
        return {
            authCredentials: CREDENTIALS
        };
    },
    {urls: ["<all_urls>"]},
    ["blocking"]
);

// 错误日志
chrome.proxy.onProxyError.addListener((details) => {
    console.error("Proxy Error:", details);
});
