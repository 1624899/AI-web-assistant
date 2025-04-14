// options.js
document.addEventListener('DOMContentLoaded', () => {
    // Keep only references to the unified input fields and the single save button
    const openaiApiKeyInput = document.getElementById('openaiApiKey');
    const googleApiKeyInput = document.getElementById('googleApiKey'); // 更改元素ID以匹配HTML
    const deepseekApiKeyInput = document.getElementById('deepseekApiKey');
    const openrouterApiKeyInput = document.getElementById('openrouterApiKey'); // Keep for now, might remove model later
    const saveBtn = document.getElementById('saveBtn');
    const statusElement = document.getElementById('status');

    // Function to toggle password visibility (Used by the unified inputs)
    function toggleVisibility(inputId) {
        const input = document.getElementById(inputId);
        if (!input) return; // Guard against missing elements
        const button = input.closest('.input-group').querySelector('.toggle-visibility'); 
        if (!button) return;
        
        if (input.type === "password") {
            input.type = "text";
            button.textContent = "隐藏"; 
        } else {
            input.type = "password";
            button.textContent = "显示"; 
        }
    }

    // Add event listeners for visibility toggles (ensure button IDs match HTML)
    // Assuming buttons now have IDs like toggle-gptApiKey-visibility etc.
    const toggleButtons = document.querySelectorAll('.toggle-visibility');
    toggleButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const inputId = event.target.dataset.targetInput; // Expecting data-target-input="gptApiKey" etc.
            if (inputId) {
                toggleVisibility(inputId);
            }
        });
    });

    // 加载已保存的 API 密钥 (from LOCAL storage)
    function loadApiKeys() {
        console.log("Loading keys from LOCAL storage...");
        // Adjust keys based on kept models if simplifying later
        chrome.storage.local.get(['openaiApiKey', 'googleApiKey', 'deepseekApiKey', 'openRouterApiKey'], (result) => {
             if (chrome.runtime.lastError) {
                console.error("Error loading keys from local storage:", chrome.runtime.lastError);
                statusElement.textContent = '加载密钥出错: ' + chrome.runtime.lastError.message;
                statusElement.className = 'status-message error';
                return;
            }
            console.log("Keys loaded from local storage:", result);
            if (result.openaiApiKey) {
                openaiApiKeyInput.value = result.openaiApiKey;
            }
            // 更新为使用googleApiKey
            if (result.googleApiKey && googleApiKeyInput) {
                googleApiKeyInput.value = result.googleApiKey;
            }
            if (result.deepseekApiKey) {
                deepseekApiKeyInput.value = result.deepseekApiKey;
            }
            if (result.openRouterApiKey && openrouterApiKeyInput) {
                openrouterApiKeyInput.value = result.openRouterApiKey;
            }
        });
    }

    // 保存 API 密钥 (to LOCAL storage) - Only uses the single save button
    function saveApiKeys() {
        const openaiKey = openaiApiKeyInput ? openaiApiKeyInput.value.trim() : '';
        const googleKey = googleApiKeyInput ? googleApiKeyInput.value.trim() : ''; // 更新变量名
        const deepseekKey = deepseekApiKeyInput ? deepseekApiKeyInput.value.trim() : '';
        const openrouterKey = openrouterApiKeyInput ? openrouterApiKeyInput.value.trim() : '';

        const keysToSave = {
            openaiApiKey: openaiKey, // 更新为正确的键名 
            googleApiKey: googleKey, // 更新为正确的键名
            deepseekApiKey: deepseekKey,
            openRouterApiKey: openrouterKey // 确保大小写正确
        };

        console.log("Attempting to save keys to LOCAL storage:", {
             openaiApiKey: openaiKey ? '[SET]' : '[EMPTY]', 
             googleApiKey: googleKey ? '[SET]' : '[EMPTY]', 
             deepseekApiKey: deepseekKey ? '[SET]' : '[EMPTY]', 
             openRouterApiKey: openrouterKey ? '[SET]' : '[EMPTY]' 
        });

        // Save to local storage instead of sync
        chrome.storage.local.set(keysToSave, () => {
            if (chrome.runtime.lastError) {
                console.error("chrome.storage.local.set Error:", chrome.runtime.lastError);
                statusElement.textContent = '保存出错: ' + chrome.runtime.lastError.message;
                statusElement.className = 'status-message error';
            } else {
                console.log("Keys saved successfully to LOCAL storage.");
                statusElement.textContent = '设置已保存！';
                statusElement.className = 'status-message success';
                // 自动隐藏状态消息
                setTimeout(() => {
                    statusElement.textContent = '';
                    statusElement.className = 'status-message';
                }, 3000);
            }
        });
    }

    // 页面加载时加载密钥
    if (saveBtn) { // Only run if the main elements exist
        loadApiKeys();
        // 点击保存按钮时保存密钥
        saveBtn.addEventListener('click', saveApiKeys);
    } else {
        console.error("Could not find main save button (#saveBtn). Ensure HTML is correct.");
    }
}); 

chrome.storage.local.get("openRouterApiKey", (result) => { console.log("后台读取 openRouterApiKey:", result); });