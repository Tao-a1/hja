
const btn = document.getElementById('toggleBtn');
const statusDiv = document.getElementById('status');

chrome.runtime.sendMessage({command: "get_status"}, (response) => {
    updateUI(response.enabled);
});

btn.addEventListener('click', () => {
    const isNowOn = btn.innerText === "关闭代理"; 
    const targetState = !isNowOn;
    
    chrome.runtime.sendMessage({command: "toggle_proxy", enable: targetState}, () => {
        updateUI(targetState);
    });
});

function updateUI(enabled) {
    if (enabled) {
        btn.innerText = "关闭代理";
        btn.className = "btn btn-off";
        statusDiv.innerText = "状态: 🟢 代理已开启";
        statusDiv.style.color = "#4CAF50";
    } else {
        btn.innerText = "开启代理";
        btn.className = "btn btn-on";
        statusDiv.innerText = "状态: ⚫ 代理已关闭";
        statusDiv.style.color = "#666";
    }
}
