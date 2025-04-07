// options.js
document.addEventListener('DOMContentLoaded', () => {
    // Keep only references to the unified input fields and the single save button
    const gptApiKeyInput = document.getElementById('gptApiKey');
    const geminiApiKeyInput = document.getElementById('geminiApiKey'); // Keep for now, might remove model later
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
        chrome.storage.local.get(['gptApiKey', 'geminiApiKey', 'deepseekApiKey', 'openrouterApiKey'], (result) => {
             if (chrome.runtime.lastError) {
                console.error("Error loading keys from local storage:", chrome.runtime.lastError);
                statusElement.textContent = '加载密钥出错: ' + chrome.runtime.lastError.message;
                statusElement.className = 'status-message error';
                return;
            }
            console.log("Keys loaded from local storage:", result);
            if (result.gptApiKey) {
                gptApiKeyInput.value = result.gptApiKey;
            }
            // Keep loading logic for now, even if models are removed later in background.js
            if (result.geminiApiKey && geminiApiKeyInput) {
                geminiApiKeyInput.value = result.geminiApiKey;
            }
            if (result.deepseekApiKey) {
                deepseekApiKeyInput.value = result.deepseekApiKey;
            }
            if (result.openrouterApiKey && openrouterApiKeyInput) {
                openrouterApiKeyInput.value = result.openrouterApiKey;
            }
        });
    }

    // 保存 API 密钥 (to LOCAL storage) - Only uses the single save button
    function saveApiKeys() {
        const gptKey = gptApiKeyInput ? gptApiKeyInput.value.trim() : '';
        const geminiKey = geminiApiKeyInput ? geminiApiKeyInput.value.trim() : ''; // Keep for now
        const deepseekKey = deepseekApiKeyInput ? deepseekApiKeyInput.value.trim() : '';
        const openrouterKey = openrouterApiKeyInput ? openrouterApiKeyInput.value.trim() : ''; // Keep for now

        const keysToSave = {
            gptApiKey: gptKey,
            geminiApiKey: geminiKey, // Save even if model removed, doesn't hurt
            deepseekApiKey: deepseekKey,
            openrouterApiKey: openrouterKey // Save even if model removed
        };

        console.log("Attempting to save keys to LOCAL storage:", {
             gptApiKey: gptKey ? '[SET]' : '[EMPTY]', 
             geminiApiKey: geminiKey ? '[SET]' : '[EMPTY]', 
             deepseekApiKey: deepseekKey ? '[SET]' : '[EMPTY]', 
             openrouterApiKey: openrouterKey ? '[SET]' : '[EMPTY]' 
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