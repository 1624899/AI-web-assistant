// background.js - Service Worker for Side Panel Architecture

// --- 创建默认图标 ---
// 动态创建图标函数 - 在没有实际PNG文件的情况下使用
function createDefaultIcons() {
  // 使用canvas动态生成各种尺寸的图标
  const sizes = [16, 32, 48, 128];
  const iconPaths = {};
  
  // 绘制标准图标 - 蓝色AI图标
  sizes.forEach(size => {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // 背景圆
    ctx.fillStyle = '#4285F4';
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2 - 1, 0, 2 * Math.PI);
    ctx.fill();
    
    // 白色AI文字
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${size * 0.4}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AI', size/2, size/2);
    
    // 使用ImageData直接设置图标，避免URL.createObjectURL错误
    const imageData = ctx.getImageData(0, 0, size, size);
    iconPaths[size] = imageData;
    
    // 当所有尺寸都完成时更新图标
    if (Object.keys(iconPaths).length === sizes.length) {
      chrome.action.setIcon({ imageData: iconPaths });
    }
  });
}

// 创建B站视频专用图标 - 粉色B站风格
function createBilibiliIcons(tabId) {
  const sizes = [16, 32, 48, 128];
  const iconPaths = {};
  
  sizes.forEach(size => {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // 粉色背景
    ctx.fillStyle = '#FB7299';
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2 - 1, 0, 2 * Math.PI);
    ctx.fill();
    
    // 白色电视图标
    ctx.fillStyle = '#FFFFFF';
    const tvWidth = size * 0.6;
    const tvHeight = size * 0.4;
    const tvX = (size - tvWidth) / 2;
    const tvY = (size - tvHeight) / 2;
    ctx.fillRect(tvX, tvY, tvWidth, tvHeight);
    
    // 画两个小天线
    const antennaSize = size * 0.1;
    ctx.beginPath();
    ctx.arc(tvX + tvWidth * 0.3, tvY - antennaSize, antennaSize, 0, 2 * Math.PI);
    ctx.arc(tvX + tvWidth * 0.7, tvY - antennaSize, antennaSize, 0, 2 * Math.PI);
    ctx.fill();
    
    // 粉色AI文字
    ctx.fillStyle = '#FB7299';
    ctx.font = `bold ${size * 0.25}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AI', size/2, size/2);
    
    // 使用ImageData直接设置图标，避免URL.createObjectURL错误
    const imageData = ctx.getImageData(0, 0, size, size);
    iconPaths[size] = imageData;
    
    // 当所有尺寸都完成时更新图标
    if (Object.keys(iconPaths).length === sizes.length) {
      chrome.action.setIcon({ tabId: tabId, imageData: iconPaths });
    }
  });
}

// --- Global Variables ---
const models = [
  {
    id: "deepseek-chat", name: "DeepSeek Chat (原生)", endpoint: "https://api.deepseek.com/chat/completions", apiKeyName: "deepseekApiKey",
  },
  {
    id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo (OpenAI 原生)", endpoint: "https://api.openai.com/v1/chat/completions", apiKeyName: "openaiApiKey",
  },
  {
    id: "openrouter-llama-4-maverick-free", name: "Llama 4 Maverick (OpenRouter 免费)", openRouterId: "meta-llama/llama-4-maverick:free", endpoint: "https://openrouter.ai/api/v1/chat/completions", apiKeyName: "openRouterApiKey",
  },
  {
    id: "openrouter-llama-4-scout-free", name: "Llama 4 Scout (OpenRouter 免费)", openRouterId: "meta-llama/llama-4-scout:free", endpoint: "https://openrouter.ai/api/v1/chat/completions", apiKeyName: "openRouterApiKey",
  },
  {
    id: "openrouter-deepseek-v3-free", name: "DeepSeek V3 (OpenRouter 免费)", openRouterId: "deepseek/deepseek-chat-v3-0324:free", endpoint: "https://openrouter.ai/api/v1/chat/completions", apiKeyName: "openRouterApiKey",
  },
  {
    id: "openrouter-gemini-2.5-pro-free", name: "Gemini Pro 2.5 Exp (OpenRouter 免费)", openRouterId: "google/gemini-2.5-pro-exp-03-25:free", endpoint: "https://openrouter.ai/api/v1/chat/completions", apiKeyName: "openRouterApiKey",
  },
   {
    id: "openrouter-qwen-2.5-vl-free", name: "Qwen 2.5 VL Instruct (OpenRouter 免费)", openRouterId: "qwen/qwen2.5-vl-72b-instruct:free", endpoint: "https://openrouter.ai/api/v1/chat/completions", apiKeyName: "openRouterApiKey",
  },
  {
    id: "openrouter-gemini-flash-2.0-free", name: "Gemini Flash 2.0 Exp (OpenRouter 免费)", openRouterId: "google/gemini-2.0-flash-exp:free", endpoint: "https://openrouter.ai/api/v1/chat/completions", apiKeyName: "openRouterApiKey",
  },
];

// 添加默认系统提示词定义
const defaultSystemPrompt = "你是一个网页内容分析助手，专注于提供清晰、准确、有用的信息。回答应该简洁但全面，保持客观并避免无关内容。";

// 视频总结提示词模板
const videoSummaryPrompt = `
请分析以下视频字幕内容，生成一个全面的视频总结。总结应包括：

1. 整体概述：用3-5句话概括视频的主要内容和价值
2. 可能感兴趣的问题：列出2-3个与视频主题相关的问题
3. 亮点时间轴：提取视频中的关键时间点和内容亮点

格式要求：
- 首先给出整体概述段落（无需标题）
- 然后列出"你可能会对以下问题感兴趣："部分
- 最后呈现"亮点"部分，每个亮点包含时间点（格式为"MM:SS"）和该时间点的关键内容简述

字幕内容：
`;

// 视频大白话提示词模板
const videoPlainLanguagePrompt = `
请用通俗易懂的语言总结以下视频字幕内容，就像跟朋友解释这个视频一样。总结应包括：

1. 视频的主要内容和目的（用简单语言表达）
2. 3-5个视频中最有价值的要点
3. 视频中的关键时间点和精彩内容

格式要求：
- 使用口语化、通俗易懂的表达方式
- 每个要点都要标明出现的时间点（格式为"MM:SS"）
- 内容要覆盖全面但表达要简洁有趣

字幕内容：
`;

// --- API Key Function ---
async function getApiKey(apiKeyName) {
  console.log(`[getApiKey] Attempting case-insensitive lookup for key '${apiKeyName}'...`);
  return new Promise((resolve, reject) => {
    if (!apiKeyName) {
        console.error("Error getting API key: keyName not provided");
        reject("Internal error: Unrecognized API key type");
        return;
    }
    chrome.storage.local.get(null, (allItems) => {
      if (chrome.runtime.lastError) {
        console.error(`Error getting all local storage:`, chrome.runtime.lastError);
        reject(`Failed to retrieve API key (${apiKeyName})`);
        return;
      }
      let foundValue = null;
      let keyFound = false;
      let matchedStorageKey = null;
      if (allItems && typeof allItems === 'object') {
        for (const key in allItems) {
          if (Object.prototype.hasOwnProperty.call(allItems, key)) {
            const lowerCaseKey = key.trim().toLowerCase();
            const lowerCaseApiKeyName = apiKeyName.trim().toLowerCase();
            if (lowerCaseKey === lowerCaseApiKeyName) {
              keyFound = true;
              matchedStorageKey = key;
              if (allItems[key]) {
                foundValue = allItems[key];
                console.log(`[getApiKey] Successfully found key '${apiKeyName}' (Original case: '${key}') via case-insensitive match.`);
                break;
              } else {
                 console.warn(`[getApiKey] Found key '${key}' (case-insensitive match) but its value is empty.`);
              }
            }
          }
        }
      } else {
          console.warn("[getApiKey] storage.local.get(null) did not return a valid object or was null.");
      }

      if (foundValue) {
        resolve(foundValue);
      } else {
        if (keyFound) {
           reject(`API key '${apiKeyName}' (found as '${matchedStorageKey}') has an empty value. Please set it in the extension options.`);
        } else {
            console.warn(`Iteration complete. Failed to find key case-insensitively: ${apiKeyName}.`);
            reject(`Please set the ${apiKeyName} API key in the extension options.`);
        }
      }
    });
  });
}

// --- Helper to send messages to the runtime (sidebar) ---
function sendRuntimeMessage(message) {
    chrome.runtime.sendMessage(message).catch(error => {
        // Ignore common error when sidebar isn't open
        if (!error.message.includes("Receiving end does not exist")) {
            console.error("Error sending runtime message:", error, message);
        }
    });
}

// --- API Call Function ---
async function callLlmApi(modelId, messages, temperature, stream = false, requestAction = "unknown") { // Pass requestAction for error context
   const model = models.find(m => m.id === modelId);
   if (!model) {
     sendRuntimeMessage({ action: "streamError", requestAction: requestAction, error: "Model configuration not found" });
     return null;
   }

   let apiKey;
   try {
     apiKey = await getApiKey(model.apiKeyName);
   } catch (error) {
      // Send the specific error message from getApiKey
      sendRuntimeMessage({ action: "streamError", requestAction: requestAction, error: error });
     return null;
   }

    const headers = {
     "Content-Type": "application/json",
   };
   let body;
   let endpoint = model.endpoint;
   let method = "POST";

   // --- Model Specific Headers & Body ---
   if (model.apiKeyName === 'openaiApiKey' || model.apiKeyName === 'deepseekApiKey' || model.apiKeyName === 'openRouterApiKey') {
     headers["Authorization"] = `Bearer ${apiKey}`;
     if (model.apiKeyName === 'openRouterApiKey') {
         headers["HTTP-Referer"] = `chrome-extension://${chrome.runtime.id}`;
         headers["X-Title"] = "AI Webpage Summarizer"; // Or your extension name
     }
     body = JSON.stringify({
       model: model.apiKeyName === 'openRouterApiKey' ? model.openRouterId : model.id,
       messages: messages,
       temperature: temperature,
       stream: stream,
     });
     headers["Accept"] = stream ? "text/event-stream" : "application/json";
   } else if (model.apiKeyName === 'googleApiKey') {
        // Placeholder for Gemini specific logic if added later
        sendRuntimeMessage({ action: "streamError", requestAction: requestAction, error: "Google API key logic not fully implemented yet." });
        return null;
   } else {
       sendRuntimeMessage({ action: "streamError", requestAction: requestAction, error: "Unsupported API type configured" });
      return null;
   }
    // --- End Model Specific ---

   console.log(`Calling LLM API (${stream ? 'Streaming' : 'Non-streaming'}) for ${requestAction}:`, endpoint);

   try {
     const response = await fetch(endpoint, {
       method: method,
       headers: headers,
       body: body,
     });

     // Return the response object directly for streaming, handle non-streaming/errors here
     if (stream) {
         if (!response.ok) {
              const errorBody = await response.text();
              let detail = errorBody;
              try { const jsonError = JSON.parse(errorBody); detail = jsonError.error?.message || JSON.stringify(jsonError); } catch (e) {}
              // Throw error to be caught below, ensuring error is sent via streamError
              throw new Error(`API request failed (${response.status} ${response.statusText}): ${detail}`);
         }
         console.log(`Streaming request successful for ${requestAction}. Returning response object.`);
         return response; // Caller handles stream reading
     }

     // Handle non-streaming response (if stream=false was used, though currently always true)
     if (!response.ok) {
       const errorBody = await response.text();
       let detail = errorBody;
       try { const jsonError = JSON.parse(errorBody); detail = jsonError.error?.message || JSON.stringify(jsonError); } catch (e) {}
        throw new Error(`API request failed (${response.status} ${response.statusText}): ${detail}`);
     }
     const data = await response.json();
     return data; // Return parsed JSON

   } catch (error) {
     console.error(`Network or API error during fetch for ${requestAction}:`, error);
      // Send error message back to sidebar
      sendRuntimeMessage({ action: "streamError", requestAction: requestAction, error: `Network or API Error: ${error.message}` });
     return null; // Indicate failure
   }
 }

// --- Request Formatting Functions ---
function formatSummaryRequest(content) {
  return [
    { role: "system", content: "你是一个专业的分析和总结助手。请务必使用中文回答。请根据以下网页内容，生成一份详细、专业、客观的正式总结。请确保：\n1. 总结内容尽可能详尽，覆盖所有关键信息点。\n2. 保持语言专业、严谨和客观。\n3. 对内容中出现的关键专业术语或缩写进行解释（例如，可以在术语后用括号进行简要说明）。\n4. 只输出总结内容，不要包含任何额外的开场白、标题或评论。\n5. 无论输入内容使用什么语言，请始终使用中文回复。" },
    { role: "user", content: content }
  ];
}
function formatPlainSummaryRequest(content) {
    return [
        { role: "system", content: "你是一个优秀的解释助手。请务必使用中文回答。请根据以下网页内容，生成一个详细的大白话版本总结。目标是让对该领域不了解的人也能轻松理解。请确保：\n1. 对内容中的关键概念和专有名词进行解释。\n2. 尽可能使用简单的语言和生活中的例子或类比来辅助说明。\n3. 内容要比正式总结更详尽，以确保解释清楚。\n4. 只输出解释和总结的内容，不要包含任何额外的开场白或标题。\n5. 无论输入内容使用什么语言，请始终使用中文回复。" },
        { role: "user", content: content }
    ];
}
function formatChatRequest(question, pageContext, chatHistory = []) {
  console.log("[formatChatRequest] Formatting with History:", chatHistory);
  const messages = [
    { role: "system", content: "你是一个AI助手。请务必使用中文回答。请根据下面提供的网页上下文和当前的对话历史，来回答用户最新的问题。优先基于上下文和历史回答，如果无法从中找到答案，可以利用你自己的知识库。无论输入内容使用什么语言，请始终使用中文回复。" },
    { role: "user", content: `网页上下文:\n--- START CONTEXT ---\n${pageContext || '无可用上下文'}\n--- END CONTEXT ---` },
    ...(Array.isArray(chatHistory) ? chatHistory : []),
    { role: "user", content: question }
  ];
  console.log("Formatted chat request messages:", JSON.stringify(messages));
  return messages;
}

// --- Stream Processing Logic ---
async function processStream(response, requestAction) {
    if (!response || !response.body) {
        sendRuntimeMessage({ action: "streamError", requestAction: requestAction, error: "Invalid stream response object received" });
        return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = '';
    console.log(`Starting stream processing for action: ${requestAction}...`);

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                console.log(`Stream finished for action: ${requestAction}.`);
                // 确保最后一个块也被处理
                if (buffer.trim()) {
                    try {
                        const lastChunk = processStreamChunk(buffer, requestAction);
                        if (lastChunk) {
                            sendRuntimeMessage({ action: "streamChunk", requestAction: requestAction, chunk: lastChunk });
                        }
                    } catch (e) {
                        console.warn(`Error processing final buffer chunk: ${e.message}`);
                    }
                }
                sendRuntimeMessage({ action: "streamEnd", requestAction: requestAction });
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            
            // 处理行 - 重要的SSE处理逻辑
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() || ''; // 保留不完整行在缓冲区

            for (const line of lines) {
                if (!line.trim()) continue; // 跳过空行
                
                // 调试日志 - 显示处理的每一行
                console.log(`[STREAM] ${requestAction} 接收行: ${line.substring(0, 50)}${line.length > 50 ? '...' : ''}`);

                // 检查是否包含错误消息
                if (line.includes('"error"') || line.includes('Rate limit exceeded') || line.includes('rate limit')) {
                    console.error(`[STREAM] ${requestAction} 检测到API错误: ${line}`);
                    try {
                        // 尝试解析错误消息
                        let errorMessage = "API错误";
                        if (line.startsWith('data: ')) {
                            const jsonData = line.substring(6).trim();
                            try {
                                const parsedData = JSON.parse(jsonData);
                                errorMessage = parsedData.error?.message || JSON.stringify(parsedData.error) || "API错误";
                            } catch (e) {
                                // 如果不是JSON，直接使用原始文本
                                errorMessage = jsonData;
                            }
                        } else {
                            // 尝试从行中提取错误信息
                            const errorMatch = line.match(/"error":\s*{([^}]+)}/);
                            if (errorMatch) {
                                const errorContent = errorMatch[1];
                                const messageMatch = errorContent.match(/"message":\s*"([^"]+)"/);
                                if (messageMatch) {
                                    errorMessage = messageMatch[1];
                                }
                            } else if (line.includes('Rate limit exceeded')) {
                                errorMessage = "API速率限制超出，请稍后再试";
                            }
                        }
                        
                        // 发送错误消息并结束流处理
                        sendRuntimeMessage({ action: "streamError", requestAction: requestAction, error: errorMessage });
                        reader.releaseLock();
                        console.log(`Stream reader released for ${requestAction} due to error.`);
                        return; // 提前退出函数
                    } catch (e) {
                        console.error(`[STREAM] ${requestAction} 处理错误消息时出错:`, e.message);
                        // 发送通用错误消息
                        sendRuntimeMessage({ action: "streamError", requestAction: requestAction, error: "API返回错误" });
                        reader.releaseLock();
                        return;
                    }
                }

                if (line.startsWith('data: ')) {
                    const jsonData = line.substring(6).trim();
                    if (jsonData === '[DONE]') continue; // OpenAI结束信号

                    try {
                        // 尝试解析JSON
                        const parsedData = JSON.parse(jsonData);
                        const chunkText = extractTextFromChunk(parsedData);
                        
                        if (chunkText) {
                            console.log(`[STREAM] ${requestAction} 提取块: [${chunkText.substring(0, 30)}${chunkText.length > 30 ? '...' : ''}]`);
                            // 将块发送到侧边栏
                            sendRuntimeMessage({ action: "streamChunk", requestAction: requestAction, chunk: chunkText });
                        }
                    } catch (e) {
                        console.error(`[STREAM] ${requestAction} 解析JSON错误:`, e.message);
                        // 尝试直接处理非JSON响应
                        if (jsonData && typeof jsonData === 'string' && jsonData !== '[DONE]') {
                            sendRuntimeMessage({ action: "streamChunk", requestAction: requestAction, chunk: jsonData });
                        }
                    }
                } else if (line.includes('"content":"') || line.includes('"text":"')) {
                    // 处理可能没有data:前缀的JSON片段
                    try {
                        const chunkText = extractTextFromRawLine(line);
                        if (chunkText) {
                            console.log(`[STREAM] ${requestAction} 从原始行提取: [${chunkText.substring(0, 30)}${chunkText.length > 30 ? '...' : ''}]`);
                            sendRuntimeMessage({ action: "streamChunk", requestAction: requestAction, chunk: chunkText });
                        }
                    } catch (e) {
                        console.warn(`[STREAM] ${requestAction} 处理非标准行错误:`, e.message);
                    }
                }
            }
        }
    } catch (error) {
        console.error(`Error reading stream for ${requestAction}:`, error);
        sendRuntimeMessage({ action: "streamError", requestAction: requestAction, error: `Error reading stream: ${error.message}` });
    } finally {
        reader.releaseLock();
        console.log(`Stream reader released for ${requestAction}.`);
    }
}

// 辅助函数：从数据块中提取文本
function extractTextFromChunk(parsedData) {
    // 处理 OpenAI / OpenRouter / DeepSeek 格式
    if (parsedData.choices && parsedData.choices[0]) {
        // Delta格式（流式）
        if (parsedData.choices[0].delta && parsedData.choices[0].delta.content) {
            return parsedData.choices[0].delta.content;
        }
        // 完整消息格式（非流式）
        if (parsedData.choices[0].message && parsedData.choices[0].message.content) {
            return parsedData.choices[0].message.content;
        }
    }
    
    // 处理 Google Gemini 格式
    if (parsedData.candidates && parsedData.candidates[0]) {
        // 检查内容部分
        if (parsedData.candidates[0].content && parsedData.candidates[0].content.parts) {
            const parts = parsedData.candidates[0].content.parts;
            // 遍历所有部分寻找文本
            for (const part of parts) {
                if (part.text) return part.text;
            }
        }
        // 部分Gemini实现可能使用不同结构
        if (parsedData.candidates[0].text) {
            return parsedData.candidates[0].text;
        }
    }
    
    // 处理专有API可能使用的其他格式
    if (parsedData.response) return parsedData.response;
    if (parsedData.content) return parsedData.content;
    if (parsedData.text) return parsedData.text;
    if (parsedData.output) return parsedData.output;
    
    // 找不到预期结构
    return null;
}

// 辅助函数：从非标准行中提取文本
function extractTextFromRawLine(line) {
    // 尝试查找常见模式
    const contentMatch = line.match(/"content"\s*:\s*"([^"]*)"/);
    if (contentMatch && contentMatch[1]) return contentMatch[1];
    
    const textMatch = line.match(/"text"\s*:\s*"([^"]*)"/);
    if (textMatch && textMatch[1]) return textMatch[1];
    
    return null;
}

// 辅助函数：处理流块
function processStreamChunk(chunk, requestAction) {
    try {
        if (!chunk.trim()) return null;
        
        // 尝试作为JSON解析
        if (chunk.startsWith('{') || chunk.startsWith('[')) {
            try {
                const parsed = JSON.parse(chunk);
                return extractTextFromChunk(parsed);
            } catch (e) {
                // 不是有效JSON，继续进行其他处理
            }
        }
        
        // 检查是否为data:格式
        if (chunk.startsWith('data:')) {
            const jsonPart = chunk.substring(5).trim();
            try {
                const parsed = JSON.parse(jsonPart);
                return extractTextFromChunk(parsed);
            } catch (e) {
                // 不是有效JSON，返回原始data内容
                return jsonPart === '[DONE]' ? null : jsonPart;
            }
        }
        
        // 如果包含明显的内容标记
        if (chunk.includes('"content":') || chunk.includes('"text":')) {
            return extractTextFromRawLine(chunk);
        }
        
        // 返回整个块作为文本（最后的后备方案）
        return chunk;
    } catch (e) {
        console.error(`Error processing chunk: ${e.message}`);
        return null;
    }
}

// --- Helper to initiate API call (used by message listener) ---
async function initiateApiCall(requestAction, content, modelId, question = null, chatHistory = [], isTranscript = false) { // 接收 isTranscript 参数
    console.log(`Initiating API call for action: ${requestAction}, isTranscript: ${isTranscript}`);
    let prompt = '';
    let messages = [];

    // 查找模型特定的系统提示词，如果没有则使用默认值
    const modelConfig = models.find(m => m.id === modelId);
    const systemPrompt = modelConfig?.systemPrompt || defaultSystemPrompt;

    // --- Construct Prompt Based on Action and Content Type ---
    if (requestAction === "getSummary") {
        if (isTranscript) {
            prompt = videoSummaryPrompt + content;
            console.log("[API Call] Using video summary prompt.");
        } else {
            prompt = "请根据以下网页内容生成一个简洁的总结，突出关键信息点。网页内容：\\n\\n" + content;
            console.log("[API Call] Using webpage summary prompt.");
        }
        messages = [{ role: "user", content: prompt }];
    } else if (requestAction === "getPlainSummary") {
        if (isTranscript) {
            prompt = videoPlainLanguagePrompt + content;
             console.log("[API Call] Using video plain language prompt.");
        } else {
            prompt = "请用简单易懂的大白话解释以下网页的主要内容，如同对一个完全不了解背景的人解释一样。网页内容：\\n\\n" + content;
             console.log("[API Call] Using webpage plain language prompt.");
        }
        messages = [{ role: "user", content: prompt }];
    } else if (requestAction === "askQuestion") {
        // 聊天请求 - 根据 isTranscript 决定上下文来源
        const contextLabel = isTranscript ? "视频字幕内容" : "网页上下文";
        prompt = `基于以下${contextLabel}，回答问题：\\"${question}\\"。${isTranscript ? '\\n如有需要，请在回答中引用视频中相关的时间点（格式为"MM:SS"）。' : ''}上下文：\\n\\n` + content;
        console.log("[API Call] Using chat prompt.");
        messages = [
             // Consider adding history back carefully if needed, ensuring context is clear
             // { role: "system", content: systemPrompt }, // System prompt already added below
             // { role: "user", content: `Context:\\n${content}` }, // Simplified context for chat history
            ...chatHistory, // Pass existing history
            { role: "user", content: prompt } // Pass the latest question with context prompt
        ];
         // Remove the redundant prompt addition from the main message construction
         // messages = messages.filter(msg => msg.content !== prompt); // Avoid duplicate prompt

    } else {
        console.error("Unknown requestAction for API call:", requestAction);
        sendRuntimeMessage({ action: "streamError", requestAction: requestAction, error: "未知的请求类型" });
        return;
    }
    
    // If a system prompt is defined for the model, prepend it
    // Make sure system prompt isn't duplicated if already added in chat logic
    if (systemPrompt && messages[0]?.role !== 'system') {
        messages.unshift({ role: "system", content: systemPrompt });
    }

    console.log(`Calling LLM with model ${modelId} for action ${requestAction}.`);

    // --- Call API (Streaming) ---
    try {
        // Ensure temperature is appropriate, 0.7 might be too creative for summaries
        const temp = (requestAction === 'getSummary' || requestAction === 'getPlainSummary') ? 0.3 : 0.7;
        const response = await callLlmApi(modelId, messages, temp, true, requestAction); 
        if (response) {
            processStream(response, requestAction);
        } else {
            console.error(`API call failed for ${requestAction}, response was null.`);
            // Error should have been sent by callLlmApi already
        }
    } catch (error) {
        console.error(`Error initiating or processing stream for ${requestAction}:`, error);
        sendRuntimeMessage({ action: "streamError", requestAction: requestAction, error: `处理流时出错: ${error.message}` });
    }
}

// --- Main Message Listener ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("====================================");
  console.log("Background received message:", message.action, "from:", sender.tab ? `Tab ${sender.tab.id}` : "Extension");
  console.log("====================================");

  // --- Actions initiated by Sidebar ---
  if (message.action === "getPageContentForAction") {
     (async () => {
         const { requestedAction, modelId, question, chatHistory, selectedText, isVideo } = message; // <-- Destructure isVideo

         // --- Handle "Explain Selected Text" directly ---
         if (selectedText && requestedAction === "getPlainSummary") {
             console.log(`Action '${requestedAction}' triggered for selected text. Using text directly.`);
             // Explicitly set isTranscript to false for selected text explanation
             initiateApiCall(requestedAction, selectedText, modelId, null, [], false); 
             sendResponse({ success: true }); 
             return; 
         }

         // --- Get Content (Strictly Transcript OR Full Page based on isVideo flag) ---
         let activeTab;
         let contentToProcess = null;
         let isTranscriptResult = false; // Flag to pass to initiateApiCall

         try {
             [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
             if (!activeTab || !activeTab.id || !activeTab.url) {
                 throw new Error("无法确定活动标签页或其URL。");
             }
             
             console.log(`[Content Fetch] Action: ${requestedAction}, isVideo Flag: ${isVideo}`);

             if (isVideo) {
                 // --- VIDEO PATH ---
                 console.log(`[Content Fetch] Attempting to get video transcript | Tab ID: ${activeTab.id}`);
                 try {
                     const transcriptResponse = await chrome.tabs.sendMessage(activeTab.id, { action: "getVideoTranscript" });
                     
                     if (transcriptResponse && transcriptResponse.transcript) {
                         console.log(`[Content Fetch] Successfully received transcript | Length: ${transcriptResponse.transcript.length}`);
                         contentToProcess = transcriptResponse.transcript;
                         isTranscriptResult = true; 
                     } else {
                         const errorMsg = transcriptResponse?.error || '内容脚本未返回有效字幕数据。';
                         console.error(`[Content Fetch] Failed to get transcript | Error: ${errorMsg}`);
                         // Throw a specific error for video failure
                         throw new Error("无法获取视频字幕。请确保视频正在播放、字幕已开启，并稍等片刻重试。"); 
                     }
                 } catch (transcriptError) {
                     console.error(`[Content Fetch] Error sending getVideoTranscript message: ${transcriptError.message}`);
                      // Throw a specific error for video failure
                     throw new Error(`无法获取视频字幕: ${transcriptError.message}. 请确保页面已完全加载并重试。`);
                 }
             } else {
                 // --- WEBPAGE PATH ---
                 console.log(`[Content Fetch] Attempting to get webpage content | Tab ID: ${activeTab.id}`);
                  // Ensure URL is valid for content script injection
                 if (!activeTab.url.startsWith('http') && !activeTab.url.startsWith('file:')) {
                     throw new Error(`不支持的页面URL: ${activeTab.url}。无法注入内容脚本。`);
                 }
                 try {
                     const contentResponse = await chrome.tabs.sendMessage(activeTab.id, { action: "getContent" });
                     
                     if (contentResponse && typeof contentResponse.content === 'string') {
                         console.log(`[Content Fetch] Successfully received page content | Length: ${contentResponse.content.length}`);
                         contentToProcess = contentResponse.content;
                         isTranscriptResult = false; 
                     } else {
                         const errorMsg = contentResponse?.error || '内容脚本未返回有效内容。';
                         console.error(`[Content Fetch] Failed to get page content | Error: ${errorMsg}`);
                         throw new Error(`获取页面内容失败: ${errorMsg}`);
                     }
                 } catch (contentError) {
                      console.error(`[Content Fetch] Error sending getContent message: ${contentError.message}`);
                      throw new Error(`无法获取页面内容: ${contentError.message}. 请刷新页面重试。`);
                 }
             }
             
             // --- Initiate API Call only if content was successfully obtained ---
             if (contentToProcess !== null) {
                 console.log(`[API Trigger] Content obtained (${isTranscriptResult ? 'Transcript' : 'Page Content'}), initiating API call for ${requestedAction}.`);
                 initiateApiCall(
                     requestedAction,
                     contentToProcess,
                     modelId,
                     question,
                     chatHistory,
                     isTranscriptResult // Pass the result flag
                 );
                 sendResponse({ success: true }); // Acknowledge sidebar request successfully
             } 
             // This 'else' should ideally not be reached due to error throwing above
             // else {
             //     console.error(`[Content Fetch] Critical Error: Reached end without content or error.`);
             //     throw new Error("未能获取任何可处理的内容。");
             // }

         } catch (error) {
             // Catch errors from tab query, messaging, or specific fetching logic
             console.error(`[Content Fetch] Overall error for Tab ${activeTab?.id}:`, error);
             let userErrorMessage = error.message || "获取内容时发生未知错误。";
             
             // Refine common errors
             if (userErrorMessage.includes("Could not establish connection") || userErrorMessage.includes("Receiving end does not exist")) {
                 userErrorMessage = isVideo 
                    ? "无法连接到视频页面脚本。请尝试重新加载页面和扩展。" 
                    : "无法连接到页面脚本。请尝试重新加载页面和扩展。";
             } else if (userErrorMessage.includes("不支持的页面URL")) {
                 userErrorMessage = "无法在此类页面上运行（例如，内部Chrome页面、设置）。";
             }
             
             sendResponse({ success: false, error: userErrorMessage });
             // Notify the sidebar directly about the failure
             sendRuntimeMessage({ action: "streamError", requestAction: requestedAction, error: `获取内容失败: ${userErrorMessage}` });
         }
         
     })();
     return true; // Indicate async response
  } 
  
  else if (message.action === "getModels") {
     sendResponse({ models: models });
  } 
  
  else if (message.action === "saveState") {
     if (message.state) {
        chrome.storage.local.set({ sidebarState: message.state });
     }
  } 
  
  else if (message.action === "openOptions") {
     chrome.runtime.openOptionsPage();
  } 
  
  else {
     console.log("Unhandled action in background script:", message.action);
  }
});


// --- Side Panel Management ---
// Automatically open the side panel when the action icon is clicked.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('Failed to set side panel behavior:', error));

// Optional: Listener for when the action icon is clicked (can add logic beyond just opening)
// chrome.action.onClicked.addListener(async (tab) => {
//     if (!tab.id) return;
//     console.log(`Action clicked for tab: ${tab.id}. Default behavior opens panel.`);
//     // You could potentially trigger a state load here if needed,
//     // but sidebar.js requesting state on load is generally cleaner.
// });


// --- Context Menu Handling ---
const CONTEXT_MENU_ID = "ai-summarize-open-sidebar";

function createContextMenu() {
  // Remove existing to prevent duplicates on reload
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: "AI 助手 (打开侧边栏并操作)", // Updated title
      contexts: ["page", "selection"] // Show for both page clicks and text selections
    });
    console.log("Context menu created/updated.");
  });
}

// Listener for context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id || info.menuItemId !== CONTEXT_MENU_ID) return;

  console.log(`Context menu '${info.menuItemId}' clicked.`);

  // 1. Ensure the side panel is open for the correct tab
  try {
      await chrome.sidePanel.open({ tabId: tab.id });
      console.log(`Side panel opened or confirmed open for tab ${tab.id}`);
  } catch (error) {
       console.error(`Failed to open side panel for tab ${tab.id}:`, error);
       // Maybe notify user? For now, just log and potentially stop.
       return;
  }

  // 2. Determine action based on context (page vs selection) and send to sidebar
  let actionDetail = {};
  if (info.selectionText) {
      // If text was selected, prepare to explain it
      actionDetail = { type: "explainSelection", text: info.selectionText.trim() };
      console.log("Context Action: Explain Selection");
  } else {
      // If clicked on the page background, prepare to summarize
      actionDetail = { type: "summarizePage" };
      console.log("Context Action: Summarize Page");
  }

  // Send the determined action to the sidebar's runtime
  sendRuntimeMessage({ action: "contextActionTriggered", detail: actionDetail });
});


// --- Lifecycle Events ---
chrome.runtime.onInstalled.addListener(details => {
  console.log(`Extension ${details.reason}. Setting up context menu.`);
  createContextMenu(); // Create menu on install/update
  
  // 初始化默认图标
  createDefaultIcons();
  
  // Perform any other first-time setup here (e.g., set default options)
});

chrome.runtime.onStartup.addListener(() => {
  console.log("Browser startup detected. Re-creating context menu just in case.");
  // While context menus often persist, re-creating can be safer.
  createContextMenu();
});

// --- Browser Action Button Logic ---
// 更新浏览器按钮状态 - 根据页面类型显示不同图标和提示
async function updateBrowserAction(tabId, url) {
  try {
    if (!url) return;
    
    // 检查是否为Bilibili视频页面
    const isBiliVideo = url.includes('bilibili.com/video/');
    
    // 更新图标和提示文字
    if (isBiliVideo) {
      // Bilibili视频页面 - 使用B站图标
      createBilibiliIcons(tabId);
      chrome.action.setTitle({
        tabId: tabId,
        title: "点击总结B站视频"
      });
      // 启用按钮
      chrome.action.enable(tabId);
    } else {
      // 非视频页面 - 使用普通图标
      // 因为没有实际的图片文件，所以我们使用默认设置
      chrome.action.setTitle({
        tabId: tabId,
        title: "AI网页助手"
      });
      // 保持按钮启用状态
      chrome.action.enable(tabId);
    }
  } catch (error) {
    console.error("更新浏览器按钮状态时出错:", error);
  }
}

// 处理浏览器按钮点击事件
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id || !tab.url) return;
  
  const isBiliVideo = tab.url.includes('bilibili.com/video/');
  
  if (isBiliVideo) {
    console.log("检测到B站视频页面，直接启动视频总结");
    try {
      // 1. 打开侧边栏
      await chrome.sidePanel.open({ tabId: tab.id });
      
      // 2. 发送消息，请求视频总结
      setTimeout(() => {
        sendRuntimeMessage({ 
          action: "quickAction", 
          actionType: "summarizeVideo"
        });
        
        // 3. 显示使用提示
        sendRuntimeMessage({
          action: "streamChunk",
          requestAction: "infoMessage",
          chunk: `
⏳ 正在获取视频字幕并生成总结...

📝 提示：为获得最佳效果，请确保
1. 视频正在播放并显示字幕
2. 对于没有官方字幕的视频，需要至少播放12秒以上
3. 如果视频有官方字幕，系统会自动优先获取完整字幕
          `
        });
      }, 500); // 给侧边栏加载一点时间
    } catch (error) {
      console.error("启动视频总结时出错:", error);
    }
  } else {
    // 非视频页面 - 只打开侧边栏
    chrome.sidePanel.open({ tabId: tab.id })
      .catch(error => console.error("打开侧边栏时出错:", error));
  }
});

// 添加页面变更监听器
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 只在页面完成加载并且有URL时触发
  if (changeInfo.status === 'complete' && tab.url) {
    console.log("检测到页面完成加载:", tab.url);
    
    // 更新浏览器按钮状态
    updateBrowserAction(tabId, tab.url);
    
    // 向侧边栏发送页面变更消息
    sendRuntimeMessage({
      action: 'pageChanged',
      url: tab.url
    });
  }
});

// 添加标签页激活变更监听器（用户切换标签页）
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    // 获取新激活的标签页信息
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      console.log("用户切换到标签页:", tab.url);
      
      // 更新浏览器按钮状态
      updateBrowserAction(activeInfo.tabId, tab.url);
      
      // 向侧边栏发送页面变更消息
      sendRuntimeMessage({
        action: 'pageChanged',
        url: tab.url
      });
    }
  } catch (error) {
    console.error("获取标签页信息出错:", error);
  }
});

console.log("AI Assistant Service Worker started (Side Panel Version).");


// --- Cache Functions ---
const cachePrefix = 'aiSummaryCache_'; // Prefix to avoid collisions
const cacheExpiryMs = 24 * 60 * 60 * 1000; // 24 hours

function getCacheKey(url) {
    if (!url || (!url.startsWith('http') && !url.startsWith('file:'))) {
        // console.warn("Skipping cache key generation for invalid/unsupported URL:", url);
        return null; // Don't cache for invalid or non-http(s)/file URLs
    }
    try {
        // Use hostname + pathname for key, ignoring query params/hash
        const urlObj = new URL(url);
        // Sanitize pathname slightly (replace slashes) - could be more robust
        const safePath = urlObj.pathname.replace(/[^a-zA-Z0-9_-]/g, '_');
        const key = `${cachePrefix}${urlObj.hostname}${safePath}`;
        // Limit key length to avoid potential storage issues
        return key.substring(0, 100); // Adjust max length if needed
    } catch (e) {
        console.error("Error creating cache key for URL:", url, e);
        return null; // Return null if URL parsing fails
    }
}

async function saveToCache(key, data) {
     if (!key) {
         // console.log("Skipping saveToCache: Invalid key provided.");
         return;
     }
    return new Promise((resolve) => {
        const cacheEntry = { data: data, timestamp: Date.now() };
        chrome.storage.local.set({ [key]: cacheEntry }, () => {
            if (chrome.runtime.lastError) {
                console.error("Error saving to cache for key:", key, chrome.runtime.lastError);
            } else {
                 // console.log(`Cache saved successfully for key: ${key}`); // Verbose log
            }
            resolve(); // Resolve even if error occurred
        });
    });
}

async function getFromCache(key) {
     if (!key) {
         // console.log("Skipping getFromCache: Invalid key provided.");
         return Promise.resolve(null);
     }
    return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
            if (chrome.runtime.lastError) {
                console.error("Error getting from cache for key:", key, chrome.runtime.lastError);
                resolve(null);
            } else if (result && result[key]) {
                const cacheEntry = result[key];
                // Check timestamp and data integrity minimally
                if (cacheEntry.timestamp && typeof cacheEntry.data !== 'undefined' && (Date.now() - cacheEntry.timestamp < cacheExpiryMs)) {
                     // console.log(`Cache hit and valid for key: ${key}`); // Verbose log
                    resolve(cacheEntry.data);
                } else {
                    console.log(`Cache expired or invalid for key: ${key}. Removing.`);
                    chrome.storage.local.remove(key); // Clean up expired/invalid entry
                    resolve(null);
                }
            } else {
                 // console.log(`Cache miss for key: ${key}`); // Verbose log
                resolve(null); // Cache miss
            }
        });
    });
}

// --- 添加网络请求监听 ---
// 监听B站字幕相关网络请求
function setupBilibiliSubtitleMonitoring() {
  // 需要监听的字幕请求URL模式
  const subtitlePatterns = [
    "*://*.bilibili.com/x/player/v2*", // 字幕列表API
    "*://*.hdslb.com/bfs/subtitle/*.json", // 字幕内容文件
    "*://i0.hdslb.com/bfs/subtitle/*.json", // 另一种字幕内容路径
    "*://s1.hdslb.com/bfs/subtitle/*.json" // 另一种字幕内容路径
  ];

  // 请求监听器，捕获B站字幕相关请求
  chrome.webRequest.onCompleted.addListener(
    (details) => {
      // 只关注成功的网络请求
      if (details.statusCode !== 200) return;
      
      // 获取相关标签页ID
      const tabId = details.tabId;
      if (tabId === -1) return; // 忽略非标签页发出的请求

      // 捕获字幕列表API请求
      if (details.url.includes("/x/player/v2")) {
        console.log(`[网络监听] 检测到字幕列表请求: ${details.url}`);
        
        // 通知content.js有字幕列表API请求
        chrome.tabs.sendMessage(tabId, {
          action: "subtitleApiDetected",
          url: details.url,
          type: "subtitleList"
        }).catch(() => {
          // 忽略错误 - content script可能尚未准备好
        });
      }
      
      // 捕获字幕内容文件请求
      if (details.url.includes("/bfs/subtitle/") && details.url.endsWith(".json")) {
        console.log(`[网络监听] 检测到字幕内容请求: ${details.url}`);
        
        // 通知content.js有字幕内容请求
        chrome.tabs.sendMessage(tabId, {
          action: "subtitleContentDetected",
          url: details.url,
          type: "subtitleContent"
        }).catch(() => {
          // 忽略错误 - content script可能尚未准备好
        });
      }
    },
    {
      urls: subtitlePatterns,
      types: ["xmlhttprequest"]
    }
  );
  
  console.log("已启用B站字幕请求监听");
}

// 启动时设置监听
setupBilibiliSubtitleMonitoring();

// --- End of background.js ---