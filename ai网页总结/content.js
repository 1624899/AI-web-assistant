// content.js - Simplified for Side Panel Architecture

console.log("AI Summarizer content script loaded (Side Panel Version).");

// --- Core Function: Content Extraction ---

async function getPageContent() {
    // Try to find main content area (common patterns)
    const selectors = [
        'main', 
        'article',
        '[role="main"]', 
        '#main', 
        '#content', 
        '.main', 
        '.content', 
    ];
    let mainContentElement = null;
    for (const selector of selectors) {
        try { // Add try...catch for invalid selectors
           mainContentElement = document.querySelector(selector);
           if (mainContentElement) {
                console.log(`Found main content using selector: ${selector}`);
                break; 
           }
        } catch(e) {
            // console.warn(`Invalid selector "${selector}":`, e); // Optional: Log invalid selectors
        }
    }

    let contentText = '';
    if (mainContentElement) {
        try {
            const clonedElement = mainContentElement.cloneNode(true);
            // Enhanced removal list
            clonedElement.querySelectorAll('script, style, nav, header, footer, aside, form, [role="navigation"], [role="banner"], [role="contentinfo"], [aria-hidden="true"], iframe, button, input, select, textarea, noscript, svg, canvas, img, figure').forEach(el => el.remove());
            
            // Try to get structured text first
            contentText = Array.from(clonedElement.querySelectorAll('p, h1, h2, h3, h4, li')) 
                           .map(el => el.textContent.trim())
                           .filter(text => text.length > 10) 
                           .join('\n\n'); 

            if (contentText.length < 200) { 
                console.warn("Main content extraction yielded little structured text, falling back to cleaned text.", contentText.length);
                contentText = getTextFromNode(clonedElement);
            }
        } catch (error) {
             console.error("Error processing main content element:", error);
             contentText = ''; // Reset contentText on error during processing
        }
    } 
    
    // If no main content found or extraction failed, fall back to body (cleaned)
    if (!contentText || contentText.length < 200) { 
        console.warn("No main content found or extraction failed/yielded little text, using full body text (cleaned).", contentText?.length);
         try {
             const bodyClone = document.body.cloneNode(true);
             bodyClone.querySelectorAll('script, style, nav, header, footer, aside, form, [role="navigation"], [role="banner"], [role="contentinfo"], [aria-hidden="true"], iframe, button, input, select, textarea, noscript, svg, canvas, img, figure').forEach(el => el.remove());
             contentText = getTextFromNode(bodyClone);
         } catch (error) {
              console.error("Error processing body clone:", error);
              contentText = document.body.innerText || document.body.textContent || ''; // Final fallback
         }
    }

    // Limit content length 
    const maxLength = 15000; // ~5k tokens limit
    if (contentText.length > maxLength) {
        console.warn(`Content length (${contentText.length}) exceeds max length (${maxLength}). Truncating.`);
        contentText = contentText.substring(0, maxLength) + "... [内容已截断]";
    } else if (!contentText) {
         console.warn("getPageContent resulted in empty string.");
         contentText = ""; // Ensure it's an empty string, not null/undefined
    }
    
    console.log(`Extracted page content length: ${contentText.length}`);
    return contentText;
}

// Helper to get text from a node, cleaning whitespace
function getTextFromNode(node) {
    try {
      // Prefer innerText as it respects rendering, but fallback
      let text = node.innerText || node.textContent || ''; 
      // Aggressive whitespace cleaning
      return text.replace(/\s{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    } catch(error) {
        console.error("Error in getTextFromNode:", error);
        return ""; // Return empty string on error
    }
}

// --- Helper Functions ---
// ... (keep existing helpers like cleanText, getTextFromNode etc.)

// 检测是否为Bilibili视频页面
function isBilibiliVideoPage() {
    // 检查域名和是否存在播放器容器
    return window.location.hostname.includes('bilibili.com') && 
           window.location.pathname.startsWith('/video/') &&
           document.querySelector('#bilibili-player'); 
}

// --- 全局变量 ---
// 存储捕获到的字幕URL
let capturedSubtitleUrls = {
  subtitleList: null,  // 字幕列表API URL
  subtitleContent: []  // 字幕内容URLs
};

// 存储已加载的字幕内容
let loadedSubtitles = {};

// --- 增加监听来自background.js的消息，处理网络请求捕获的字幕 ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 处理扩展消息
  if (message.action === "getContent") {
    // 获取页面内容的处理...（保持原有代码）
    getPageContent().then(content => {
      sendResponse({ content: content });
    }).catch(error => {
      sendResponse({ error: error.message });
    });
    return true; // 异步响应
  } 
  else if (message.action === "getVideoTranscript") {
    // 获取视频字幕的处理...（保持原有代码）
    getBilibiliTranscript().then(transcript => {
      sendResponse({ transcript: transcript });
    }).catch(error => {
      sendResponse({ error: error.message });
    });
    return true; // 异步响应
  }
  // 处理字幕列表API URL捕获
  else if (message.action === "subtitleApiDetected") {
    console.log(`[捕获] 收到字幕列表API URL: ${message.url}`);
    capturedSubtitleUrls.subtitleList = message.url;
    // 尝试从URL中获取cid和aid/bvid参数
    const urlObj = new URL(message.url);
    const cid = urlObj.searchParams.get('cid');
    const aid = urlObj.searchParams.get('aid');
    const bvid = urlObj.searchParams.get('bvid');
    if (cid) {
      console.log(`[捕获] 从字幕API URL中提取到参数 - cid: ${cid}, aid: ${aid || 'N/A'}, bvid: ${bvid || 'N/A'}`);
      // 可以存储这些参数供后续使用
    }
    // 如果当前正在获取字幕，可以自动加载
    tryFetchSubtitleFromCapturedUrls();
  }
  // 处理字幕内容URL捕获
  else if (message.action === "subtitleContentDetected") {
    console.log(`[捕获] 收到字幕内容URL: ${message.url}`);
    // 避免重复添加相同URL
    if (!capturedSubtitleUrls.subtitleContent.includes(message.url)) {
      capturedSubtitleUrls.subtitleContent.push(message.url);
      // 自动获取字幕内容
      fetchSubtitleContent(message.url);
    }
  }
  
  // 处理其他消息...
});

// 尝试从捕获的URL获取字幕内容
async function tryFetchSubtitleFromCapturedUrls() {
  console.log("[字幕获取] 尝试从捕获的URL获取字幕内容");
  
  // 如果有字幕内容URL，直接获取内容
  if (capturedSubtitleUrls.subtitleContent.length > 0) {
    console.log(`[字幕获取] 发现${capturedSubtitleUrls.subtitleContent.length}个字幕内容URL，开始获取`);
    for (const url of capturedSubtitleUrls.subtitleContent) {
      await fetchSubtitleContent(url);
    }
    return;
  }
  
  // 如果有字幕列表URL但没有内容URL，尝试获取字幕列表
  if (capturedSubtitleUrls.subtitleList) {
    console.log(`[字幕获取] 使用字幕列表URL: ${capturedSubtitleUrls.subtitleList}`);
    try {
      const response = await fetch(capturedSubtitleUrls.subtitleList, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Referer': window.location.href,
          'Origin': window.location.origin
        }
      });
      
      if (!response.ok) {
        throw new Error(`获取字幕列表失败: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      if (data.code !== 0) {
        throw new Error(`字幕列表API返回错误: ${data.message}`);
      }
      
      // 提取字幕URL
      if (data.data && data.data.subtitle && data.data.subtitle.subtitles && data.data.subtitle.subtitles.length > 0) {
        const subtitles = data.data.subtitle.subtitles;
        console.log(`[字幕获取] 从API找到${subtitles.length}个字幕`);
        
        // 优先使用中文字幕
        let targetSubtitle = subtitles.find(s => s.lan.includes('zh')) || subtitles[0];
        if (targetSubtitle.subtitle_url) {
          const subtitleUrl = targetSubtitle.subtitle_url.startsWith('http') 
            ? targetSubtitle.subtitle_url 
            : `https:${targetSubtitle.subtitle_url}`;
          
          console.log(`[字幕获取] 选择字幕: ${targetSubtitle.lan_doc}, URL: ${subtitleUrl}`);
          capturedSubtitleUrls.subtitleContent.push(subtitleUrl);
          await fetchSubtitleContent(subtitleUrl);
        }
      } else {
        console.log("[字幕获取] 字幕列表API中未找到字幕");
      }
    } catch (error) {
      console.error("[字幕获取] 获取字幕列表失败:", error);
    }
  }
}

// 获取字幕内容
async function fetchSubtitleContent(url) {
  // 检查是否已经加载过
  if (loadedSubtitles[url]) {
    console.log(`[字幕获取] 已加载过此字幕: ${url}`);
    return loadedSubtitles[url];
  }
  
  console.log(`[字幕获取] 获取字幕内容: ${url}`);
  try {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Referer': window.location.href,
        'Origin': window.location.origin
      }
    });
    
    if (!response.ok) {
      throw new Error(`获取字幕内容失败: ${response.status} ${response.statusText}`);
    }
    
    const subtitleData = await response.json();
    if (subtitleData && subtitleData.body && Array.isArray(subtitleData.body)) {
      console.log(`[字幕获取] 成功获取字幕，共${subtitleData.body.length}条记录`);
      
      // 存储字幕内容
      loadedSubtitles[url] = subtitleData;
      
      // 通知字幕加载完成事件
      document.dispatchEvent(new CustomEvent('bilibili_subtitle_loaded', { 
        detail: { 
          url: url,
          data: subtitleData
        }
      }));
      
      return subtitleData;
    } else {
      console.log("[字幕获取] 字幕内容格式不正确:", subtitleData);
      return null;
    }
  } catch (error) {
    console.error("[字幕获取] 获取字幕内容失败:", error);
    return null;
  }
}

// 添加字幕加载事件监听，监控B站播放器中的字幕变化
function setupSubtitleLoadMonitoring() {
  console.log("[字幕监听] 设置字幕加载监听");
  
  // 监听字幕加载完成事件
  document.addEventListener('bilibili_subtitle_loaded', (event) => {
    console.log(`[字幕监听] 字幕已加载: ${event.detail.url}`);
    // 可以在这里处理加载完成的字幕数据
  });
  
  // 监听B站播放器初始化
  const checkPlayerReady = setInterval(() => {
    const player = document.querySelector('.bpx-player-container, #bilibili-player');
    if (player) {
      console.log("[字幕监听] 检测到B站播放器已加载");
      clearInterval(checkPlayerReady);
      
      // 监听播放器中的字幕控制元素
      const subtitleBtn = document.querySelector('.bpx-player-ctrl-subtitle');
      if (subtitleBtn) {
        console.log("[字幕监听] 找到字幕控制按钮");
        
        // 检查字幕是否已开启
        const isSubtitleOn = subtitleBtn.classList.contains('bpx-state-on');
        console.log(`[字幕监听] 字幕状态: ${isSubtitleOn ? '已开启' : '未开启'}`);
        
        // 如果字幕未开启，可以考虑自动开启
        if (!isSubtitleOn) {
          console.log("[字幕监听] 字幕未开启，考虑是否需要自动开启");
          // subtitleBtn.click(); // 自动开启字幕（可选择是否启用）
        }
      }
      
      // 设置MutationObserver监听字幕容器变化
      setupSubtitleContainerObserver();
    }
  }, 1000);
  
  // 最多检查10秒
  setTimeout(() => clearInterval(checkPlayerReady), 10000);
}

// 设置字幕容器观察器
function setupSubtitleContainerObserver() {
  console.log("[字幕监听] 设置字幕容器观察器");
  
  // 定义所有可能的字幕容器选择器
  const subtitleSelectors = [
    '.bpx-player-subtitle',
    '.bpx-player-subtitle-panel-text',
    '.bpx-player-subtitle-inner-text',
    '.bilibili-player-video-subtitle'
  ];
  
  // 尝试查找字幕容器
  let subtitleContainer = null;
  for (const selector of subtitleSelectors) {
    const container = document.querySelector(selector);
    if (container) {
      subtitleContainer = container;
      console.log(`[字幕监听] 找到字幕容器: ${selector}`);
      break;
    }
  }
  
  // 如果找不到容器，监听整个播放器区域
  if (!subtitleContainer) {
    console.log("[字幕监听] 未找到字幕容器，将监听整个播放器区域");
    subtitleContainer = document.querySelector('.bpx-player-container, #bilibili-player');
  }
  
  if (subtitleContainer) {
    // 创建MutationObserver监听字幕变化
    const subtitleObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // 节点添加可能是字幕更新
        if (mutation.addedNodes.length > 0) {
          // 检查是否有字幕文本变化
          const subtitleElements = document.querySelectorAll('.bpx-player-subtitle-panel-text, .bpx-player-subtitle-inner-text');
          subtitleElements.forEach(element => {
            const text = element.textContent.trim();
            if (text && text.length > 0) {
              console.log(`[字幕监听] 检测到字幕文本: "${text}"`);
              
              // 可以在这里处理检测到的字幕文本
              // 例如，添加到本地字幕集合中
            }
          });
        }
      }
    });
    
    // 启动观察器
    subtitleObserver.observe(subtitleContainer, { 
      childList: true,
      subtree: true,
      characterData: true
    });
    
    console.log("[字幕监听] 字幕变化观察器已启动");
  }
}

// 在页面加载后启动字幕监听
document.addEventListener('DOMContentLoaded', () => {
  // 检查是否为B站视频页面
  if (window.location.href.includes('bilibili.com/video/')) {
    console.log("[初始化] 检测到B站视频页面，启动字幕监控");
    setupSubtitleLoadMonitoring();
  }
});

// 修改getBilibiliTranscript函数，整合网络请求捕获的字幕
async function getBilibiliTranscript() {
  console.log("========== 开始获取Bilibili字幕 ==========");
  
  // 获取视频标题和UP主信息增强上下文
  const videoTitle = document.querySelector('.video-title, .tit, h1')?.innerText || "未知视频标题";
  const uploader = document.querySelector('.up-name, .username')?.innerText || "未知UP主";
  const videoId = window.location.pathname.match(/\/video\/([^\/]+)/)?.[1] || "";
  console.log(`📌 视频信息 | 标题: ${videoTitle} | UP主: ${uploader} | 视频ID: ${videoId}`);
  
  let transcript = "";
  let subtitleSuccess = false;
  let diagnosticInfo = [];
  
  // 方法1: 尝试使用已捕获的网络请求获取字幕 (优先级最高)
  console.log("🔍 尝试方法1: 使用网络请求监听获取的字幕...");
  diagnosticInfo.push("尝试使用网络监听捕获的字幕");
  
  // 记录当前捕获的字幕URL状态
  if (capturedSubtitleUrls.subtitleList) {
    diagnosticInfo.push(`已捕获字幕列表API: ${capturedSubtitleUrls.subtitleList}`);
  }
  
  if (capturedSubtitleUrls.subtitleContent.length > 0) {
    diagnosticInfo.push(`已捕获${capturedSubtitleUrls.subtitleContent.length}个字幕内容URL`);
    
    // 检查是否已有加载完成的字幕
    const loadedKeys = Object.keys(loadedSubtitles);
    if (loadedKeys.length > 0) {
      console.log(`✅ 找到${loadedKeys.length}个已加载的字幕内容`);
      diagnosticInfo.push(`找到${loadedKeys.length}个已加载的字幕内容`);
      
      // 使用第一个加载的字幕
      const firstKey = loadedKeys[0];
      const subtitleData = loadedSubtitles[firstKey];
      
      if (subtitleData && subtitleData.body && Array.isArray(subtitleData.body)) {
        console.log(`✅ 使用网络捕获的字幕数据，共${subtitleData.body.length}条记录`);
        diagnosticInfo.push(`使用网络捕获的字幕，${subtitleData.body.length}条记录`);
        
        // 构建带时间戳的字幕内容
        const formattedSubtitles = subtitleData.body.map(item => {
          // 将秒数转换为MM:SS格式
          const seconds = Math.floor(item.from);
          const minutes = Math.floor(seconds / 60);
          const remainingSeconds = seconds % 60;
          const timestamp = `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
          
          return `[${timestamp}] ${item.content}`;
        }).join('\n');
        
        // 构建完整文本
        transcript = `
【视频标题】${videoTitle}
【UP主】${uploader}
【字幕来源】网络请求捕获的官方字幕 (${subtitleData.body.length}条)
【成功】✅ 已获取完整官方字幕 (通过网络请求监听)

${formattedSubtitles}
        `;
        
        subtitleSuccess = true;
        console.log("✅✅✅ 通过网络请求监听获取字幕成功");
        return transcript;
      }
    } else {
      // 尝试获取字幕内容
      console.log("🔄 已有字幕URL但未加载内容，尝试加载...");
      await tryFetchSubtitleFromCapturedUrls();
      
      // 再次检查是否成功加载
      const loadedKeys = Object.keys(loadedSubtitles);
      if (loadedKeys.length > 0) {
        const firstKey = loadedKeys[0];
        const subtitleData = loadedSubtitles[firstKey];
        
        if (subtitleData && subtitleData.body && Array.isArray(subtitleData.body)) {
          console.log(`✅ 成功加载字幕数据，共${subtitleData.body.length}条记录`);
          diagnosticInfo.push(`成功加载字幕，${subtitleData.body.length}条记录`);
          
          // 构建带时间戳的字幕内容
          const formattedSubtitles = subtitleData.body.map(item => {
            const seconds = Math.floor(item.from);
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            const timestamp = `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
            
            return `[${timestamp}] ${item.content}`;
          }).join('\n');
          
          // 构建完整文本
          transcript = `
【视频标题】${videoTitle}
【UP主】${uploader}
【字幕来源】网络请求捕获并加载的官方字幕 (${subtitleData.body.length}条)
【成功】✅ 已获取完整官方字幕 (通过网络请求监听)

${formattedSubtitles}
          `;
          
          subtitleSuccess = true;
          console.log("✅✅✅ 通过网络请求监听获取字幕成功");
          return transcript;
        }
      }
    }
  }
  
  // 方法2: 从DOM中捕获显示的字幕 (备选方案)
  if (!subtitleSuccess) {
    console.log("🔄 切换到DOM字幕捕获方法...");
    diagnosticInfo.push("切换到DOM字幕捕获方法");
    
    // 尝试自动开启字幕（如果目前没有开启）
    try {
      const subtitleButton = document.querySelector('.bpx-player-ctrl-subtitle');
      if (subtitleButton) {
        const isSubtitleOn = subtitleButton.classList.contains('bpx-state-on');
        console.log(`字幕按钮状态: ${isSubtitleOn ? '已开启' : '未开启'}`);
        diagnosticInfo.push(`字幕按钮状态: ${isSubtitleOn ? '已开启' : '未开启'}`);
        
        // 如果字幕没有开启，尝试点击按钮开启
        if (!isSubtitleOn) {
          console.log("🔄 尝试自动开启字幕...");
          diagnosticInfo.push("尝试自动开启字幕");
          subtitleButton.click();
          console.log("✅ 字幕按钮已点击，等待1秒让字幕显示");
          // 等待1秒让字幕有时间显示
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (e) {
      console.log("⚠️ 尝试自动开启字幕时出错:", e);
      diagnosticInfo.push("自动开启字幕失败");
    }
    
    // 检测是否有字幕容器 - 使用更精确的选择器
    const actualSubtitleSelectors = [
      '.bpx-player-subtitle-panel-text', // 新版播放器的实际字幕文本
      '.bpx-player-subtitle', // 新版播放器字幕
      '.bpx-player-subtitle-inner', // 新版播放器字幕内部容器
      '.bpx-player-subtitle-inner-text', // 新版播放器字幕文本
      '.bpx-player-subtitle-wrap', // 新版播放器字幕包装器
      '.bilibili-player-video-subtitle', // 旧版播放器字幕
      '.bilibili-player-video-subtitle-content', // 旧版字幕内容
      '.player-auxiliary-subtitle-text-wrap', // 实际显示的字幕文本
      '.subtitle-item', // 字幕项
      '.subtitle-text', // 字幕文本
      '[data-v-7933b7b8]' // 有时会有这种特殊标记的元素
    ];
    
    const subtitleContainers = [];
    for (const selector of actualSubtitleSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log(`✅ 找到字幕容器: ${selector}, 数量: ${elements.length}`);
        diagnosticInfo.push(`找到字幕容器: ${selector} (${elements.length}个)`);
        elements.forEach(el => subtitleContainers.push(el));
      }
    }
    
    // 如果依然没找到字幕容器，尝试查找可能包含字幕的其他元素
    if (subtitleContainers.length === 0) {
      console.log("⚠️ 未找到标准字幕容器，尝试查找更广泛的元素...");
      diagnosticInfo.push("尝试查找更广泛的字幕元素");
      
      // 尝试查找播放器区域内的所有文本容器
      const playerContainer = document.querySelector('.bpx-player-container, #bilibili-player');
      if (playerContainer) {
        const potentialSubtitleElements = playerContainer.querySelectorAll('div[class*="subtitle"], div[class*="text"], span[class*="text"]');
        console.log(`找到${potentialSubtitleElements.length}个潜在字幕元素`);
        
        if (potentialSubtitleElements.length > 0) {
          potentialSubtitleElements.forEach(el => {
            // 检查这个元素是否可能是字幕容器（基于位置、样式等）
            const style = window.getComputedStyle(el);
            const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0;
            const isInViewport = el.getBoundingClientRect().bottom < window.innerHeight * 0.9; // 在视口底部90%范围内
            
            if (isVisible && isInViewport) {
              console.log(`✅ 找到潜在字幕元素: ${el.className}`);
              subtitleContainers.push(el);
            }
          });
        }
      }
    }
    
    if (subtitleContainers.length === 0) {
      console.log("⚠️ 未找到任何字幕容器，检查DOM结构:");
      diagnosticInfo.push("未找到字幕容器，检查页面状态");
      
      // 检查视频播放器状态
      const playerElement = document.querySelector('video');
      if (playerElement) {
        console.log(`✅ 找到视频元素 | 时长: ${playerElement.duration}秒 | 当前时间: ${playerElement.currentTime}秒 | 是否暂停: ${playerElement.paused}`);
        diagnosticInfo.push(`找到视频元素 (时长: ${Math.floor(playerElement.duration)}秒, 已播放: ${Math.floor(playerElement.currentTime)}秒)`);
        
        // 如果视频是暂停状态，尝试自动播放
        if (playerElement.paused) {
          try {
            console.log("🔄 检测到视频暂停中，尝试自动播放...");
            diagnosticInfo.push("尝试自动播放视频");
            const playPromise = playerElement.play();
            if (playPromise !== undefined) {
              playPromise.then(() => {
                console.log("✅ 视频已开始播放");
                diagnosticInfo.push("视频已自动开始播放");
              }).catch(e => {
                console.log("❌ 自动播放失败:", e);
                diagnosticInfo.push("自动播放失败，可能需要用户交互");
              });
            }
          } catch (e) {
            console.log("❌ 尝试自动播放时出错:", e);
          }
        }
        
        // 检查字幕是否开启
        const subtitleButton = document.querySelector('.bpx-player-ctrl-subtitle');
        if (subtitleButton) {
          console.log(`✅ 找到字幕按钮，字幕状态: ${subtitleButton.classList.contains('bpx-state-on') ? '开启' : '关闭'}`);
          diagnosticInfo.push(`字幕按钮状态: ${subtitleButton.classList.contains('bpx-state-on') ? '开启' : '关闭'}`);
          
          // 如果字幕关闭，再次提示用户
          if (!subtitleButton.classList.contains('bpx-state-on')) {
            diagnosticInfo.push("⚠️ 字幕当前为关闭状态，请点击视频播放器右下角字幕按钮开启");
          }
        } else {
          console.log("⚠️ 未找到字幕按钮");
          diagnosticInfo.push("未找到字幕控制按钮");
        }
      } else {
        console.log("❌ 未找到视频元素，视频可能未加载");
        diagnosticInfo.push("未找到视频元素");
      }
    }
    
    // 获取视频时长和当前进度
    let videoDuration = "未知";
    let currentTime = "00:00";
    
    try {
      // 尝试获取视频元素
      const videoElement = document.querySelector('video');
      if (videoElement) {
        videoDuration = formatTime(videoElement.duration);
        currentTime = formatTime(videoElement.currentTime);
        console.log(`📊 视频当前时间: ${currentTime}, 总时长: ${videoDuration}`);
        diagnosticInfo.push(`视频播放信息: ${currentTime}/${videoDuration}`);
      }
    } catch (err) {
      console.error("❌ 获取视频时间信息出错:", err);
      diagnosticInfo.push("获取视频时间失败");
    }
    
    // 尝试获取视频信息
    const duration = document.querySelector('.bilibili-player-video-time-total, .bpx-player-ctrl-time-duration')?.textContent || videoDuration;
    console.log(`📊 视频时长: ${duration}`);
    
    // 如果没有找到字幕容器，尝试从页面提取内容作为替代
    if (subtitleContainers.length === 0) {
      console.log("⚠️ 未找到字幕容器，将尝试提取页面主要内容作为替代");
      diagnosticInfo.push("无法获取字幕，切换到页面内容提取");
      try {
        const pageContent = await getPageContent();
        console.log("✅ 已获取页面内容作为替代");
        
        const status = diagnosticInfo.join('\n• ');
        return `
【视频标题】${videoTitle}
【UP主】${uploader}
【视频时长】${duration}
【字幕来源】无字幕，使用页面内容
【状态】⚠️ 未找到字幕，使用页面内容替代

【诊断信息】
• ${status}

【提示】为获得更好的总结效果，请确保:
1. 视频已开启字幕显示（点击播放器右下角字幕按钮）
2. 播放视频一段时间后再尝试总结
3. 理想情况下，选择有官方字幕的视频

${pageContent.substring(0, 5000)}
        `;
      } catch (error) {
        throw new Error("未找到字幕容器且无法提取页面内容: " + error.message);
      }
    }
    
    // 创建一个用于存储带时间戳的字幕的数组
    let timestampedSubtitles = [];
    
    // 特别处理：在监听前先尝试获取字幕，并添加当前视频播放时间
    const captureCurrentSubtitles = () => {
      try {
        const videoElement = document.querySelector('video');
        if (!videoElement) return [];
        
        let capturedItems = [];
        subtitleContainers.forEach(container => {
          const visibleText = container.innerText || container.textContent;
          if (visibleText && visibleText.trim()) {
            const cleanText = cleanSubtitleText(visibleText);
            if (cleanText) {
              const currentSec = Math.floor(videoElement.currentTime);
              const timestamp = formatTime(currentSec);
              capturedItems.push({
                time: timestamp,
                seconds: currentSec,
                text: cleanText
              });
            }
          }
        });
        return capturedItems;
      } catch (err) {
        console.error("❌ 捕获当前字幕出错:", err);
        return [];
      }
    };
    
    // 清理字幕文本的辅助函数
    function cleanSubtitleText(text) {
      if (!text) return "";
      
      // 过滤设置选项文本
      const settingsKeywords = [
        '字幕大小', '字幕颜色', '描边方式', '默认位置', '背景不透明度',
        '最小', '较小', '适中', '较大', '最大',
        '白色', '红色', '紫色', '深紫色', '靛青色', '蓝色', '亮蓝色',
        '无描边', '重墨', '描边', '投影',
        '左下角', '底部居中', '右下角', '左上角', '顶部居中', '右上角'
      ];
      
      // 计算关键词出现次数
      let keywordCount = 0;
      for (const keyword of settingsKeywords) {
        if (text.includes(keyword)) {
          keywordCount++;
          if (keywordCount >= 2) return ""; // 包含2个及以上关键词视为设置文本，返回空
        }
      }
      
      // 清理文本
      let cleanText = text.trim()
        .replace(/字幕大小|字幕颜色|描边方式|默认位置|背景不透明度|最小|较小|适中|较大|最大|白色|红色|紫色|深紫色|靛青色|蓝色|亮蓝色|无描边|重墨|描边|投影|左下角|底部居中|右下角|左上角|顶部居中|右上角/g, '')
        .trim();
      
      // 过滤过短文本
      if (cleanText.length < 3) return "";
      
      return cleanText;
    }
    
    // 格式化时间的辅助函数
    function formatTime(seconds) {
      if (typeof seconds !== 'number' || isNaN(seconds)) return "00:00";
      
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    // 先获取当前显示的字幕
    const initialSubtitles = captureCurrentSubtitles();
    if (initialSubtitles.length > 0) {
      timestampedSubtitles.push(...initialSubtitles);
      console.log(`✅ 初始字幕捕获成功，获取到${initialSubtitles.length}条带时间戳的字幕`);
      diagnosticInfo.push(`初始捕获到${initialSubtitles.length}条字幕`);
    } else {
      console.log("⚠️ 初始字幕捕获失败，未获取到字幕");
      diagnosticInfo.push("初始字幕捕获失败");
    }
    
    // 使用MutationObserver监听字幕变化
    return new Promise((resolve, reject) => {
      console.log("🔍 开始设置字幕变化监听...");
      diagnosticInfo.push("设置字幕变化监听 (12秒)");
      
      // 设置超时，确保有足够的字幕数据但不会过长等待
      const captureTimeMs = 12000; // 监听12秒
      const checkIntervalMs = 1000; // 每秒检查一次
      
      // 显示字幕捕获状态信息
      console.log(`⏳ 开始监听字幕变化，将在${captureTimeMs/1000}秒内收集字幕...`);
      
      // 监听字幕更新
      const subtitleObserver = new MutationObserver(mutations => {
        const newSubtitles = captureCurrentSubtitles();
        if (newSubtitles.length > 0) {
          // 检查是否已捕获此字幕(根据文本和时间附近性判断)
          for (const newSub of newSubtitles) {
            // 查找是否已存在相同文本且时间相近的字幕
            const exists = timestampedSubtitles.some(existingSub => 
              existingSub.text === newSub.text && 
              Math.abs(existingSub.seconds - newSub.seconds) < 3 // 时间差小于3秒视为相同字幕
            );
            
            if (!exists) {
              timestampedSubtitles.push(newSub);
              console.log(`➕ 新增字幕: [${newSub.time}] ${newSub.text}`);
            }
          }
        }
      });
      
      // 为每个字幕容器设置观察器
      subtitleContainers.forEach(container => {
        subtitleObserver.observe(container, { 
          childList: true, 
          characterData: true,
          subtree: true,
          characterDataOldValue: true 
        });
      });
      
      // 还可以定时捕获，确保不漏过快速变化的字幕
      const intervalId = setInterval(() => {
        const newSubtitles = captureCurrentSubtitles();
        if (newSubtitles.length > 0) {
          for (const newSub of newSubtitles) {
            const exists = timestampedSubtitles.some(existingSub => 
              existingSub.text === newSub.text && 
              Math.abs(existingSub.seconds - newSub.seconds) < 3
            );
            
            if (!exists) {
              timestampedSubtitles.push(newSub);
            }
          }
        }
      }, checkIntervalMs);
      
      // 监听结束后整理字幕
      setTimeout(() => {
        // 清理定时器和观察器
        clearInterval(intervalId);
        subtitleObserver.disconnect();
        console.log("✅ 字幕捕获完成，停止监听");
        diagnosticInfo.push(`字幕捕获完成，共${timestampedSubtitles.length}条`);
        
        // 按时间排序字幕
        timestampedSubtitles.sort((a, b) => a.seconds - b.seconds);
        
        // 构建最终输出
        let formattedOutput;
        
        if (timestampedSubtitles.length > 0) {
          console.log(`✅ 成功捕获了${timestampedSubtitles.length}条字幕`);
          
          // 格式化为带时间戳的文本
          const subtitleLines = timestampedSubtitles.map(sub => `[${sub.time}] ${sub.text}`).join('\n');
          
          const status = diagnosticInfo.join('\n• ');
          formattedOutput = `
【视频标题】${videoTitle}
【UP主】${uploader}
【视频时长】${duration}
【字幕来源】动态捕获 (共${timestampedSubtitles.length}条)
【状态】⚠️ 未找到官方字幕，使用动态捕获

【诊断信息】
• ${status}

【提示】为获得更好的总结效果，请:
1. 尽量选择有官方字幕的B站视频
2. 播放视频至少12秒钟让脚本捕获足够字幕
3. 如果字幕较少，结果可能不全面

${subtitleLines}
          `;
        } else {
          // 如果没有捕获到任何字幕，则提取页面内容作为备选
          console.log("⚠️ 未捕获到任何字幕，回退到页面内容提取");
          diagnosticInfo.push("未捕获到任何字幕");
          
          getPageContent().then(pageContent => {
            const status = diagnosticInfo.join('\n• ');
            resolve(`
【视频标题】${videoTitle}
【UP主】${uploader}
【视频时长】${duration}
【字幕来源】无法捕获字幕，使用页面内容
【状态】❌ 未能获取任何字幕

【诊断信息】
• ${status}

【提示】为获得更好的总结效果，请:
1. 确保视频已开启字幕显示（点击播放器右下角字幕按钮）
2. 播放视频一段时间再尝试总结
3. 理想情况下，选择有官方字幕的视频

${pageContent.substring(0, 5000)}
            `);
          }).catch(error => {
            reject("未捕获到字幕且无法提取页面内容: " + error.message);
          });
          return; // 避免重复resolve
        }
        
        resolve(formattedOutput);
      }, captureTimeMs);
    });
  }
}

// --- Message Listener (Simplified) --- 
// Keep track if listener is attached to avoid duplicates if script is injected multiple times
let contentMessageListenerAttached = false; 

function ensureContentMessageListener() {
    if (contentMessageListenerAttached) {
        // console.log("Content script listener already attached.");
        return;
    }

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log("Content script received message:", request);

      if (request.action === 'getContent') {
          (async () => { // Use async immediately
              try {
                  const pageContent = await getPageContent();
                  console.log("Sending content back to background.");
                  sendResponse({ content: pageContent });
              } catch (error) {
                   console.error("Error getting page content:", error);
                   sendResponse({ error: `获取页面内容时出错: ${error.message}` });
              }
          })();
          return true; // Indicate that the response is asynchronous
      } 
      else if (request.action === 'getVideoTranscript') {
          (async () => {
              if (!isBilibiliVideoPage()) {
                  console.log("Not a Bilibili video page, cannot get transcript.");
                  sendResponse({ error: "当前页面不是有效的Bilibili视频页面" });
                  return;
              }
              try {
                  const transcript = await getBilibiliTranscript();
                  console.log("Sending transcript back to background.");
                  sendResponse({ transcript: transcript });
              } catch (error) {
                   console.error("Error getting Bilibili transcript:", error);
                   sendResponse({ error: `获取B站字幕时出错: ${error.message}` });
              }
          })();
          return true; // 异步
      }
      else if (request.action === 'getSelectedText') {
           const selectedText = window.getSelection().toString().trim();
           console.log("Sending selected text back to background:", selectedText);
           sendResponse({ selectedText: selectedText });
           return false; // Synchronous response
      }
      else {
          console.log("Content script ignoring unknown action:", request.action);
          // Optional: return false if no async response is planned
      }
       // Return false if not handling this message or if response is synchronous
       return false; 
    });

    contentMessageListenerAttached = true;
    console.log("Content script message listener attached.");
}

// --- Initial Setup --- 
ensureContentMessageListener(); // Make sure the listener is ready 