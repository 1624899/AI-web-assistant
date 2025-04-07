document.addEventListener('DOMContentLoaded', () => {
  const modelSelect = document.getElementById('modelSelect');
  const summarizeBtn = document.getElementById('summarizeBtn');
  const floatingWindowBtn = document.getElementById('floatingWindowBtn');
  const openOptionsBtn = document.getElementById('openOptionsBtn');

  let currentModelId = ''; // 保存当前选中的模型ID

  // 打开选项页面
  openOptionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // 1. 获取并填充模型列表
  function populateModelList() {
    modelSelect.innerHTML = '<option value="">加载中...</option>';
    summarizeBtn.disabled = true;
    floatingWindowBtn.disabled = true;
    
    chrome.runtime.sendMessage({ action: "getModels" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("获取模型列表失败: ", chrome.runtime.lastError.message);
        modelSelect.innerHTML = '<option value="">无法加载模型</option>';
        return;
      }
      if (response && response.models && response.models.length > 0) {
        modelSelect.innerHTML = ''; // 清空 "加载中..." 选项
        response.models.forEach(model => {
          const option = document.createElement('option');
          option.value = model.id;
          option.textContent = model.name;
          modelSelect.appendChild(option);
        });
        loadSelectedModel(); // Load saved selection or default
      } else {
        modelSelect.innerHTML = '<option value="">无可用模型</option>';
      }
    });
  }

  // 2. 加载已保存的模型选择
  function loadSelectedModel() {
    chrome.storage.sync.get(['selectedModelId'], (result) => {
      const savedModelId = result.selectedModelId;
      if (savedModelId && modelSelect.querySelector(`option[value="${savedModelId}"]`)) {
        modelSelect.value = savedModelId;
      } else if (modelSelect.options.length > 0) {
        modelSelect.selectedIndex = 0;
        saveSelectedModel(modelSelect.value); // Save the default if nothing was saved
      }
      currentModelId = modelSelect.value;
      const hasValidModel = !!currentModelId;
      summarizeBtn.disabled = !hasValidModel;
      floatingWindowBtn.disabled = !hasValidModel;
    });
  }

  // 3. 保存当前选择的模型 ID 到 chrome.storage.sync
  function saveSelectedModel(modelId) {
    chrome.storage.sync.set({ selectedModelId: modelId }, () => {
      if (chrome.runtime.lastError) {
        console.error("保存模型选择失败: ", chrome.runtime.lastError.message);
      }
    });
  }

  // 4. 监听模型下拉菜单的变化事件
  modelSelect.addEventListener('change', () => {
    currentModelId = modelSelect.value;
    saveSelectedModel(currentModelId);
    const hasValidModel = !!currentModelId;
    summarizeBtn.disabled = !hasValidModel;
    floatingWindowBtn.disabled = !hasValidModel;
  });

  // 初始化流程：只获取模型列表
  populateModelList();

  summarizeBtn.addEventListener('click', () => {
    if (!currentModelId) {
      alert('请先选择一个模型。');
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0 || !tabs[0].id) {
          alert('无法获取当前标签页信息。');
          return;
      }
      const tabId = tabs[0].id;
      
      console.log(`Popup: Sending openSidebarAndSummarize to tab ${tabId}`);
      chrome.tabs.sendMessage(
        tabId,
        { 
          action: "openSidebarAndSummarize", 
          modelId: currentModelId
        },
        (response) => {
          if (chrome.runtime.lastError) {
              if (chrome.runtime.lastError.message?.includes("Receiving end does not exist")) {
                  console.warn(`Content script not ready in tab ${tabId}. Attempting to inject...`);
                  chrome.scripting.executeScript(
                      { target: { tabId: tabId }, files: ['content.js'] },
                      () => {
                          if (chrome.runtime.lastError) {
                              console.error(`Failed to inject content script into tab ${tabId}:`, chrome.runtime.lastError);
                              alert('无法与页面通信，请刷新页面后重试。');
                          } else {
                              console.log(`Content script injected into tab ${tabId}. Retrying message...`);
                              setTimeout(() => {
                                  chrome.tabs.sendMessage(tabId, { 
                                      action: "openSidebarAndSummarize", 
                                      modelId: currentModelId 
                                  }, (retryResponse) => {
                                      if (chrome.runtime.lastError) {
                                           console.error(`Error sending message after injection to tab ${tabId}:`, chrome.runtime.lastError);
                                           alert('与页面通信失败，请刷新页面后重试。');
                                      } else {
                                           console.log("Message resent successfully after injection.");
                                           window.close();
                                      }
                                  });
                              }, 200);
                          }
                      }
                  );
              } else {
                console.error(`Error sending message to tab ${tabId}:`, chrome.runtime.lastError);
                alert('与页面通信时发生错误。');
              }
          } else {
            console.log("Popup: Message sent successfully, closing popup.");
            window.close();
          }
        }
      );
    });
  });

  floatingWindowBtn.addEventListener('click', () => {
    if (!currentModelId) {
      alert('请先选择一个模型。');
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
       if (!tabs || tabs.length === 0 || !tabs[0].id) {
          alert('无法获取当前标签页信息。');
          return;
      }
      const tabId = tabs[0].id;
      
      console.log(`Popup: Sending openFloatingWindow to tab ${tabId}`);
      chrome.tabs.sendMessage(
        tabId,
        { action: "openFloatingWindow", modelId: currentModelId },
        (response) => {
          if (chrome.runtime.lastError) {
             if (chrome.runtime.lastError.message?.includes("Receiving end does not exist")) {
                  console.warn(`Content script not ready in tab ${tabId}. Attempting to inject...`);
                  chrome.scripting.executeScript(
                      { target: { tabId: tabId }, files: ['content.js'] },
                      () => {
                          if (chrome.runtime.lastError) {
                              console.error(`Failed to inject content script into tab ${tabId}:`, chrome.runtime.lastError);
                              alert('无法与页面通信，请刷新页面后重试。');
                          } else {
                              console.log(`Content script injected into tab ${tabId}. Retrying message...`);
                              setTimeout(() => {
                                  chrome.tabs.sendMessage(tabId, { 
                                      action: "openFloatingWindow", 
                                      modelId: currentModelId 
                                  }, (retryResponse) => {
                                      if (chrome.runtime.lastError) {
                                           console.error(`Error sending message after injection to tab ${tabId}:`, chrome.runtime.lastError);
                                           alert('与页面通信失败，请刷新页面后重试。');
                                      } else {
                                           console.log("Message resent successfully after injection.");
                                           window.close();
                                      }
                                  });
                              }, 200);
                          }
                      }
                  );
              } else {
                console.error(`Error sending message to tab ${tabId}:`, chrome.runtime.lastError);
                alert('与页面通信时发生错误。');
              }
          } else {
             console.log("Popup: Message sent successfully, closing popup.");
             window.close();
          }
        }
      );
    });
  });
}); 