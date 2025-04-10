// sidebar.js - 侧边栏页面的逻辑

console.log("sidebar.js 已加载。");

// --- 全局变量（特定于侧边栏上下文） ---
let currentTab = 'summary'; 
let currentModelId = null;
let modelListCache = null;
let currentPageUrl = ''; // 添加当前页面URL变量

// 内容状态变量
let originalSummary = '';
let plainLanguageSummary = '';
let chatMessages = []; 

// 请求状态
let isRequestPending = false;
let currentStreamTarget = null; 
let accumulatedStreamContent = '';

// DOM 元素引用（在 DOM 加载后缓存）
let modelSelectElement = null;
let tabContentElement = null;
let chatHistoryElement = null;
let chatInputElement = null;
let chatSendButtonElement = null;
let notificationElement = null; // 新增的通知元素引用
let pageChangePromptElement = null; // 新增页面变更提示元素

// 添加自动滚动控制变量
let autoScroll = true;
let userHasScrolled = false;

// --- 初始化 ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("侧边栏 DOM 已加载。");
    
    // 缓存 DOM 元素
    modelSelectElement = document.getElementById('ai-summary-model-select');
    tabContentElement = document.getElementById('ai-summary-tab-content');
    // 注意：聊天元素在切换到聊天标签时动态创建
    
    // 创建通知元素
    createNotificationElement();
    
    // 创建页面变更提示元素
    createPageChangePromptElement();

    // 创建简单的Markdown解析器（内联方式）
    setupSimpleMarkdownParser();

    // 设置监听器
    setupModelListener();
    setupTabListeners();
    setupSettingsButtonListener();
    setupPageChangeListener();

    // 初始填充和状态恢复
    populateModelDropdown();
    // 恢复状态？我们可能需要来自背景脚本关于当前页面的信息
    // 现在，只是设置初始标签视图
    switchTab(currentTab);
    
    // 保存当前页面URL
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs && tabs[0]) {
            currentPageUrl = tabs[0].url;
            console.log("初始化当前页面URL:", currentPageUrl);
        }
    });
    
    // 通知背景脚本侧边栏已准备好（可选，但可能有用）
    // chrome.runtime.sendMessage({ action: "sidebarReady" });
});

// 创建页面变更提示元素
function createPageChangePromptElement() {
    pageChangePromptElement = document.createElement('div');
    pageChangePromptElement.className = 'ai-page-change-prompt';
    pageChangePromptElement.style.display = 'none';
    document.body.appendChild(pageChangePromptElement);
    
    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
        .ai-page-change-prompt {
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 15px;
            width: 280px;
            background-color: white;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(255, 107, 157, 0.15);
            z-index: 9999;
            transition: opacity 0.3s, transform 0.3s;
            opacity: 0;
            transform: translateY(20px);
            font-size: 14px;
            border-left: 3px solid #ff8db4;
        }
        .ai-page-change-prompt.visible {
            opacity: 1;
            transform: translateY(0);
        }
        .ai-page-change-prompt-title {
            font-weight: 600;
            margin-bottom: 8px;
            color: #ff6b9d;
        }
        .ai-page-change-prompt-message {
            margin-bottom: 10px;
            color: #555;
        }
        .ai-page-change-prompt-buttons {
            display: flex;
            gap: 8px;
            margin-bottom: 10px;
        }
        .ai-page-change-prompt-button {
            flex: 1;
            padding: 8px 0;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 13px;
            transition: background-color 0.2s, transform 0.1s;
            text-align: center;
        }
        .ai-page-change-prompt-button.primary {
            background-color: #ff6b9d;
            color: white;
        }
        .ai-page-change-prompt-button.primary:hover {
            background-color: #ff5090;
            transform: translateY(-1px);
        }
        .ai-page-change-prompt-button.secondary {
            background-color: #fff0f5;
            color: #ff6b9d;
        }
        .ai-page-change-prompt-button.secondary:hover {
            background-color: #ffd6e6;
        }
        .ai-page-change-prompt-close {
            position: absolute;
            top: 8px;
            right: 8px;
            background: none;
            border: none;
            color: #ffb0cc;
            cursor: pointer;
            font-size: 18px;
            line-height: 1;
            padding: 0;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .ai-page-change-prompt-close:hover {
            color: #ff6b9d;
        }
        .ai-page-change-prompt-divider {
            height: 1px;
            background-color: #ffd6e6;
            margin: 10px 0;
        }
        .ai-page-change-prompt-actions {
            display: flex;
            gap: 8px;
        }
        .ai-page-change-prompt-actions .ai-page-change-prompt-button {
            background-color: #fff0f5;
            color: #ff6b9d;
            border: 1px solid #ffd6e6;
        }
        .ai-page-change-prompt-actions .ai-page-change-prompt-button:hover {
            background-color: #ffd6e6;
            border-color: #ff6b9d;
        }
    `;
    document.head.appendChild(style);
}

// 显示页面变更提示
function showPageChangePrompt(newPageUrl) {
    if (!pageChangePromptElement) return;
    
    // 清除之前可能存在的定时器
    if (pageChangePromptElement.timeoutId) {
        clearTimeout(pageChangePromptElement.timeoutId);
    }
    
    // 检查是否是Bilibili视频页
    const isBilibiliVideo = newPageUrl && newPageUrl.includes('bilibili.com/video/');
    
    // 更新提示内容 - 根据是否为B站视频显示不同按钮
    pageChangePromptElement.innerHTML = `
        <button class="ai-page-change-prompt-close" id="ai-page-change-close">&times;</button>
        <div class="ai-page-change-prompt-title">${isBilibiliVideo ? '检测到Bilibili视频' : '检测到页面变更'}</div>
        <div class="ai-page-change-prompt-message">${isBilibiliVideo ? '您正在观看B站视频，需要AI分析视频内容吗？' : '您浏览了新页面，需要生成新的AI内容吗？'}</div>
        <div class="ai-page-change-prompt-buttons">
            ${isBilibiliVideo ? `
            <button class="ai-page-change-prompt-button primary" id="ai-page-change-analyze-video">分析视频</button>
            <button class="ai-page-change-prompt-button secondary" id="ai-page-change-plain-video">视频大白话</button>
            ` : `
            <button class="ai-page-change-prompt-button primary" id="ai-page-change-summary">生成总结</button>
            <button class="ai-page-change-prompt-button secondary" id="ai-page-change-plain">大白话</button>
            `}
            <button class="ai-page-change-prompt-button secondary" id="ai-page-change-chat">提问</button>
        </div>
        <div class="ai-page-change-prompt-divider"></div>
        <div class="ai-page-change-prompt-actions">
            <button class="ai-page-change-prompt-button secondary" id="ai-page-change-clear">清除内容</button>
            <button class="ai-page-change-prompt-button secondary" id="ai-page-change-keep">保留内容</button>
        </div>
    `;
    
    // 显示提示
    pageChangePromptElement.style.display = 'block';
    // 使用延迟触发动画效果
    setTimeout(() => {
        pageChangePromptElement.classList.add('visible');
    }, 10);
    
    // 添加按钮事件监听
    document.getElementById('ai-page-change-close').addEventListener('click', hidePageChangePrompt);
    
    // 添加清除内容按钮事件
    document.getElementById('ai-page-change-clear').addEventListener('click', () => {
        // 清空内容状态
        originalSummary = '';
        plainLanguageSummary = '';
        chatMessages = [];
        // 更新UI
        switchTab(currentTab);
        hidePageChangePrompt();
    });
    
    // 添加保留内容按钮事件
    document.getElementById('ai-page-change-keep').addEventListener('click', () => {
        // 仅更新当前页面URL
        currentPageUrl = newPageUrl;
        hidePageChangePrompt();
    });
    
    if (isBilibiliVideo) {
        document.getElementById('ai-page-change-analyze-video').addEventListener('click', () => {
            // 清空内容状态
            originalSummary = '';
            plainLanguageSummary = '';
            chatMessages = [];
            switchTab('summary');
            requestFormalSummary(true);
            hidePageChangePrompt();
        });
        document.getElementById('ai-page-change-plain-video').addEventListener('click', () => {
            // 清空内容状态
            originalSummary = '';
            plainLanguageSummary = '';
            chatMessages = [];
            switchTab('plain');
            requestPlainSummary(true);
            hidePageChangePrompt();
        });
    } else {
        document.getElementById('ai-page-change-summary').addEventListener('click', () => {
            // 清空内容状态
            originalSummary = '';
            plainLanguageSummary = '';
            chatMessages = [];
            switchTab('summary');
            requestFormalSummary(false);
            hidePageChangePrompt();
        });
        document.getElementById('ai-page-change-plain').addEventListener('click', () => {
            // 清空内容状态
            originalSummary = '';
            plainLanguageSummary = '';
            chatMessages = [];
            switchTab('plain');
            requestPlainSummary(false);
            hidePageChangePrompt();
        });
    }
    
    document.getElementById('ai-page-change-chat').addEventListener('click', () => {
        switchTab('chat');
        hidePageChangePrompt();
    });
    
    // 设置自动消失的定时器 (10秒)
    pageChangePromptElement.timeoutId = setTimeout(hidePageChangePrompt, 10000);
    
    // 更新当前页面URL
    currentPageUrl = newPageUrl;
}

// 隐藏页面变更提示
function hidePageChangePrompt() {
    if (!pageChangePromptElement) return;
    
    pageChangePromptElement.classList.remove('visible');
    setTimeout(() => {
        pageChangePromptElement.style.display = 'none';
    }, 300); // 等待淡出动画完成
    
    // 清除定时器
    if (pageChangePromptElement.timeoutId) {
        clearTimeout(pageChangePromptElement.timeoutId);
        pageChangePromptElement.timeoutId = null;
    }
}

// 设置页面变更监听器
function setupPageChangeListener() {
    // 页面变更的逻辑已移至主消息监听器
    console.log("页面变更监听已设置 (通过主消息监听器)");
}

// 创建通知元素
function createNotificationElement() {
    notificationElement = document.createElement('div');
    notificationElement.className = 'ai-notification';
    notificationElement.style.display = 'none';
    document.body.appendChild(notificationElement);
    
    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
        .ai-notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 16px;
            border-radius: 8px;
            background-color: #fff;
            box-shadow: 0 4px 12px rgba(255, 107, 157, 0.15);
            z-index: 10000;
            transition: opacity 0.3s, transform 0.3s;
            opacity: 0;
            transform: translateY(-10px);
            max-width: 300px;
            border-left: 3px solid #ff8db4;
        }
        .ai-notification.visible {
            opacity: 1;
            transform: translateY(0);
        }
        .ai-notification.success {
            border-left-color: #ff8db4;
        }
        .ai-notification.error {
            border-left-color: #ff5c8d;
        }
        .ai-notification.info {
            border-left-color: #ffa8c5;
        }
        .ai-notification-title {
            font-weight: 600;
            margin-bottom: 4px;
            color: #ff6b9d;
        }
        .ai-notification-message {
            color: #444;
            font-size: 13px;
            margin: 0;
        }
        .ai-notification-close {
            position: absolute;
            top: 8px;
            right: 8px;
            background: none;
            border: none;
            color: #ffb0cc;
            cursor: pointer;
            font-size: 16px;
            line-height: 1;
            padding: 0;
            width: 18px;
            height: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .ai-notification-close:hover {
            color: #ff6b9d;
        }
    `;
    document.head.appendChild(style);
}

// 显示通知
function showNotification(message, type = 'info', duration = 3000) {
    if (!notificationElement) return;
    
    // 清除之前可能存在的定时器
    if (notificationElement.timeoutId) {
        clearTimeout(notificationElement.timeoutId);
    }
    
    // 设置标题基于通知类型
    let title = '提示';
    if (type === 'success') title = '成功';
    if (type === 'error') title = '错误';
    
    // 更新通知内容
    notificationElement.innerHTML = `
        <button class="ai-notification-close">&times;</button>
        <div class="ai-notification-title">${title}</div>
        <div class="ai-notification-message">${message}</div>
    `;
    
    // 设置类型并显示
    notificationElement.className = `ai-notification ${type}`;
    notificationElement.style.display = 'block';
    
    // 使用延迟触发动画效果
    setTimeout(() => {
        notificationElement.classList.add('visible');
    }, 10);
    
    // 添加关闭按钮事件
    const closeBtn = notificationElement.querySelector('.ai-notification-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', hideNotification);
    }
    
    // 设置自动隐藏
    notificationElement.timeoutId = setTimeout(hideNotification, duration);
}

// 隐藏通知
function hideNotification() {
    if (!notificationElement) return;
    
    notificationElement.classList.remove('visible');
    
    // 等待动画完成后隐藏元素
    setTimeout(() => {
        notificationElement.style.display = 'none';
    }, 300);
}

// 设置简单的Markdown解析器（不依赖外部库）
function setupSimpleMarkdownParser() {
    window.simpleMarkdown = {
        // 解析Markdown文本
        parse: function(text) {
            if (!text) return '';
            
            // 打印原始文本（调试用）
            console.log("原始Markdown文本:", text.substring(0, 100) + (text.length > 100 ? "..." : ""));
            
            // 转义HTML特殊字符
            let html = escapeHtml(text);
            
            // 处理代码块（需要在其他处理前完成，避免内部被解析）
            html = html.replace(/```([^`]+)```/g, function(match, code) {
                return '<pre><code>' + code + '</code></pre>';
            });
            
            // 处理标题 - 增加h4、h5、h6的支持
            html = html.replace(/^###### (.*?)$/gm, '<h6>$1</h6>');
            html = html.replace(/^##### (.*?)$/gm, '<h5>$1</h5>');
            html = html.replace(/^#### (.*?)$/gm, '<h4>$1</h4>');
            html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
            html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
            html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
            
            // 处理加粗
            html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
            
            // 处理斜体
            html = html.replace(/\*([^\*]+)\*/g, '<em>$1</em>');
            html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
            
            // 处理内联代码
            html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
            
            // 处理无序列表
            html = html.replace(/(?:^|\n)[ \t]*[\-\*][ \t]+(.*?)(?=\n|$)/g, '<li>$1</li>');
            html = html.replace(/(?:^|\n)<li>(.*?)(?:\n<li>.*?)*(?=\n|$)/g, '<ul>$&</ul>');
            
            // 处理有序列表
            html = html.replace(/(?:^|\n)[ \t]*(\d+)\.[ \t]+(.*?)(?=\n|$)/g, '<li>$2</li>');
            
            // 修复可能的列表嵌套问题
            html = html.replace(/<\/ul><ul>/g, '');
            
            // 处理表格 - 简单实现
            html = processMarkdownTables(html);
            
            // 处理链接
            html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
            
            // 处理段落 - 将双换行符替换为段落标记
            html = html.replace(/\n\s*\n/g, '</p><p>');
            html = '<p>' + html + '</p>';
            
            // 修复可能导致的嵌套段落问题
            html = html.replace(/<p><(h[1-6]|ul|ol|pre|table)>/g, '<$1>');
            html = html.replace(/<\/(h[1-6]|ul|ol|pre|table)><\/p>/g, '</$1>');
            
            // 打印最终HTML（调试用）
            console.log("最终渲染HTML:", html.substring(0, 100) + (html.length > 100 ? "..." : ""));
            
            return html;
        }
    };
    
    console.log("内置Markdown解析器已设置");
}

// 处理Markdown表格
function processMarkdownTables(html) {
    // 查找Markdown表格部分
    const tablePattern = /\|(.+)\|\s*\n\|([\s\-:]+)\|\s*\n((?:\|.+\|\s*\n?)+)/g;
    
    return html.replace(tablePattern, function(match, headerRow, alignmentRow, bodyRows) {
        // 处理表头
        const headers = headerRow.split('|').map(cell => cell.trim());
        
        // 处理对齐方式
        const alignments = alignmentRow.split('|').map(cell => {
            cell = cell.trim();
            if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
            if (cell.endsWith(':')) return 'right';
            return 'left';
        });
        
        // 生成表格HTML - 表头
        let tableHtml = '<table border="1" cellpadding="5" cellspacing="0"><thead><tr>';
        headers.forEach((header, i) => {
            if (header && alignments[i]) {
                tableHtml += `<th style="text-align:${alignments[i]}">${header}</th>`;
            }
        });
        tableHtml += '</tr></thead><tbody>';
        
        // 处理表格内容
        const rows = bodyRows.trim().split('\n');
        rows.forEach(row => {
            const cells = row.split('|').map(cell => cell.trim());
            tableHtml += '<tr>';
            cells.forEach((cell, i) => {
                if (cell && alignments[i]) {
                    tableHtml += `<td style="text-align:${alignments[i]}">${cell}</td>`;
                }
            });
            tableHtml += '</tr>';
        });
        
        tableHtml += '</tbody></table>';
        return tableHtml;
    });
}

// 使用Markdown渲染文本
function renderMarkdown(text) {
    try {
        // 处理null或undefined情况
        if (text === null || text === undefined) {
            console.warn("renderMarkdown: 传入的文本为null或undefined");
            return "";
        }
        
        if (typeof text !== 'string') {
            console.error("renderMarkdown: 传入的文本不是字符串:", typeof text);
            return "错误：无法渲染非文本内容";
        }
        
        // 使用我们的简单Markdown解析器
        return window.simpleMarkdown.parse(text);
    } catch (error) {
        console.error("Markdown解析错误:", error, "原始文本:", text);
        // 如果解析失败，返回原始文本并用<br>替换换行符
        try {
            return escapeHtml(String(text)).replace(/\n/g, '<br>');
        } catch (e) {
            console.error("Markdown回退处理失败:", e);
            return ""; // 最后的安全措施
        }
    }
}

// --- 事件监听器设置 ---
function setupModelListener() {
    if (modelSelectElement) {
        modelSelectElement.addEventListener('change', handleModelChange);
    }
}

function setupTabListeners() {
    const tabs = document.querySelectorAll('.ai-summary-tab-button');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            switchTab(tab.dataset.tab);
        });
    });
}

function setupSettingsButtonListener() {
    const settingsButton = document.getElementById('ai-summary-settings');
    if (settingsButton) {
        settingsButton.addEventListener('click', openOptionsPage);
    }
}

// --- UI 逻辑（将从 content.js 移动/调整） ---

function switchTab(tabName) {
    console.log(`切换侧边栏视图到：${tabName}`);
    currentTab = tabName; // 更新全局状态

    // 更新标签按钮样式
    const tabs = document.querySelectorAll('.ai-summary-tab-button');
     tabs.forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabName);
        // 应用特定的活动样式（也可以完全在 CSS 中完成）
        if (t.dataset.tab === tabName) {
             t.style.color = '#4e6ef2';
             t.style.borderBottomColor = '#4e6ef2';
             t.style.backgroundColor = '#ffffff';
         } else {
             t.style.color = ''; 
             t.style.borderBottomColor = 'transparent';
             t.style.backgroundColor = 'transparent';
         }
    });

    if (!tabContentElement) return;

    // 清除之前的内容
    tabContentElement.innerHTML = ''; 

    // 根据 tabName 和当前状态变量渲染新内容
    // 待办：将渲染逻辑从 content.js 移动到这里
    switch (tabName) {
        case 'summary':
             renderSummaryTab();
            break;
        case 'plain':
             renderPlainTab();
            break;
        case 'chat':
             renderChatTab();
            break;
    }
}

function renderSummaryTab() {
    if (!tabContentElement) return;
    
    const isBilibiliVideo = currentPageUrl && currentPageUrl.includes('bilibili.com/video/');
    const buttonId = isBilibiliVideo ? 'analyze-video-btn' : 'generate-summary-btn';
    const buttonText = isBilibiliVideo ? '分析视频内容' : '生成正式总结';
    const requestFunction = isBilibiliVideo ? () => requestFormalSummary(true) : () => requestFormalSummary(false);
    const regenerateButtonText = isBilibiliVideo ? '重新分析视频' : '重新生成总结';

    // 添加视频分析按钮样式
    if (!document.getElementById('video-btn-styles')) {
        const style = document.createElement('style');
        style.id = 'video-btn-styles';
        style.textContent = `
            .video-action-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                width: 100%;
                padding: 12px 16px;
                background-color: #ff6b9d;
                color: white;
                border: none;
                border-radius: 10px;
                font-size: 15px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                box-shadow: 0 2px 8px rgba(255, 107, 157, 0.2);
                margin-bottom: 16px;
            }
            
            .video-action-btn .icon {
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
            }
            
            .video-action-btn:hover {
                background-color: #ff5090;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(255, 107, 157, 0.3);
            }
            
            .video-action-btn:active {
                transform: translateY(1px);
                box-shadow: 0 1px 4px rgba(255, 107, 157, 0.2);
            }
            
            .video-action-btn.secondary {
                background-color: white;
                color: #ff6b9d;
                border: 1px solid #ffd6e6;
            }
            
            .video-action-btn.secondary:hover {
                background-color: #fff0f5;
                border-color: #ff6b9d;
            }
            
            .video-action-btn.loading {
                opacity: 0.7;
                cursor: not-allowed;
                pointer-events: none;
            }
            
            .video-action-btn.loading .spinner {
                display: inline-block;
                width: 16px;
                height: 16px;
                border: 2px solid rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                border-top-color: white;
                animation: spin 1s linear infinite;
                margin-right: 8px;
            }
            
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            
            .video-info-box {
                background-color: #f9f9f9;
                border-radius: 10px;
                padding: 12px 16px;
                margin-bottom: 16px;
                border-left: 3px solid #ff6b9d;
            }
            
            .video-info-box p {
                margin: 6px 0;
            }
            
            .video-info-box em {
                font-style: normal;
                color: #ff6b9d;
                font-weight: 500;
            }
            
            .video-summary-container {
                position: relative;
                margin-top: 20px;
            }
            
            .video-summary-info {
                font-size: 12px;
                color: #888;
                margin-bottom: 8px;
                text-align: right;
            }
        `;
        document.head.appendChild(style);
    }

    let contentHTML = '';
    if (isRequestPending && currentStreamTarget === 'getSummary') {
        if (isBilibiliVideo) {
            contentHTML = `
                <div class="video-info-box">
                    <p>正在分析<em>B站视频</em>，请稍候...</p>
                    <p>AI助手将根据视频字幕内容生成智能分析</p>
                </div>
                <button class="video-action-btn loading" disabled>
                    <span class="spinner"></span>视频分析中...
                </button>
                <div class="ai-summary-loading">
                    <div class="ai-summary-spinner"></div>
                    <p>正在处理中...</p> 
                </div>
                <div class="content"></div>
            `;
        } else {
            setLoadingState(true, "正在生成总结...", 'getSummary');
        }
        tabContentElement.innerHTML = contentHTML;
    } else if (originalSummary) {
        if (isBilibiliVideo) {
            contentHTML = `
                <div class="video-summary-container">
                    <div class="video-summary-info">✓ AI视频分析已完成</div>
                    <div class="ai-summary-text">${renderMarkdown(originalSummary)}</div>
                    <button id="${buttonId}" class="video-action-btn secondary">
                        <span class="icon">🔄</span>${regenerateButtonText}
                    </button>
                </div>
            `;
        } else {
            contentHTML = `
                <div class="ai-summary-text">${renderMarkdown(originalSummary)}</div>
                <button id="${buttonId}" class="ai-summary-regenerate-btn">${regenerateButtonText}</button>
            `;
        }
        tabContentElement.innerHTML = contentHTML;
        tabContentElement.querySelector(`#${buttonId}`)?.addEventListener('click', requestFunction);
    } else {
        if (isBilibiliVideo) {
            contentHTML = `
                <div class="video-info-box">
                    <p>检测到您正在浏览<em>B站视频</em></p>
                    <p>AI助手可以分析视频内容，提供关键信息总结</p>
                </div>
                <button id="${buttonId}" class="video-action-btn">
                    <span class="icon">🎬</span>${buttonText}
                </button>
            `;
        } else {
            contentHTML = `<button id="${buttonId}">${buttonText}</button>`;
        }
        tabContentElement.innerHTML = contentHTML;
        tabContentElement.querySelector(`#${buttonId}`)?.addEventListener('click', requestFunction);
    }
}

function renderPlainTab() {
    if (!tabContentElement) return;

    const isBilibiliVideo = currentPageUrl && currentPageUrl.includes('bilibili.com/video/');
    const buttonId = isBilibiliVideo ? 'plain-video-btn' : 'generate-plain-btn';
    const buttonText = isBilibiliVideo ? '生成视频大白话' : '生成大白话版本';
    const requestFunction = isBilibiliVideo ? () => requestPlainSummary(true) : () => requestPlainSummary(false);
    const regenerateButtonText = isBilibiliVideo ? '重新生成视频大白话' : '重新生成大白话';

    let contentHTML = '';
    if (isRequestPending && currentStreamTarget === 'getPlainSummary') {
        if (isBilibiliVideo) {
            contentHTML = `
                <div class="video-info-box">
                    <p>正在处理<em>B站视频</em>内容，请稍候...</p>
                    <p>AI助手将用通俗易懂的语言解释视频内容</p>
                </div>
                <button class="video-action-btn loading" disabled>
                    <span class="spinner"></span>生成大白话中...
                </button>
                <div class="ai-summary-loading">
                    <div class="ai-summary-spinner"></div>
                    <p>正在处理中...</p> 
                </div>
                <div class="content"></div>
            `;
        } else {
            setLoadingState(true, "正在生成大白话版本...", 'getPlainSummary');
        }
        tabContentElement.innerHTML = contentHTML;
    } else if (plainLanguageSummary) {
        if (isBilibiliVideo) {
            contentHTML = `
                <div class="video-summary-container">
                    <div class="video-summary-info">✓ 视频大白话已完成</div>
                    <div class="ai-summary-text">${renderMarkdown(plainLanguageSummary)}</div>
                    <button id="${buttonId}" class="video-action-btn secondary">
                        <span class="icon">🔄</span>${regenerateButtonText}
                    </button>
                </div>
            `;
        } else {
            contentHTML = `
                <div class="ai-summary-text">${renderMarkdown(plainLanguageSummary)}</div>
                <button id="${buttonId}" class="ai-summary-regenerate-btn">${regenerateButtonText}</button>
            `;
        }
        tabContentElement.innerHTML = contentHTML;
        tabContentElement.querySelector(`#${buttonId}`)?.addEventListener('click', requestFunction);
    } else {
        if (isBilibiliVideo) {
            contentHTML = `
                <div class="video-info-box">
                    <p>检测到您正在浏览<em>B站视频</em></p>
                    <p>AI助手可以将视频内容转换为通俗易懂的语言</p>
                </div>
                <button id="${buttonId}" class="video-action-btn">
                    <span class="icon">🗣️</span>${buttonText}
                </button>
            `;
        } else {
            contentHTML = `<button id="${buttonId}">${buttonText}</button>`;
        }
        tabContentElement.innerHTML = contentHTML;
        tabContentElement.querySelector(`#${buttonId}`)?.addEventListener('click', requestFunction);
    }
}

function renderChatTab() {
    if (!tabContentElement) return;
    
    // 添加CSS样式来支持复制高亮和滚动改进
    const chatStyles = document.getElementById('ai-chat-custom-styles');
    if (!chatStyles) {
        const style = document.createElement('style');
        style.id = 'ai-chat-custom-styles';
        style.textContent = `
            .ai-summary-chat-history {
                overflow-y: auto;
                max-height: calc(100vh - 150px);
                padding: 10px;
                scroll-behavior: smooth;
            }
            
            .copy-highlight {
                animation: highlight-flash 0.3s ease;
            }
            
            @keyframes highlight-flash {
                0% { background-color: transparent; }
                50% { background-color: rgba(255, 182, 193, 0.2); }
                100% { background-color: transparent; }
            }
            
            .ai-chat-copy-btn.copy-success {
                color: #ff6b9d;
                transform: scale(1.2);
                transition: all 0.2s ease;
            }
            
            .ai-chat-header {
                position: sticky;
                top: 0;
                background: white;
                z-index: 10;
                padding: 8px 0;
                border-bottom: 1px solid #f0f0f0;
            }
            
            .ai-summary-chat-container {
                display: flex;
                flex-direction: column;
                height: 100%;
                overflow: hidden;
            }
            
            .ai-summary-chat-input {
                position: sticky;
                bottom: 0;
                background: white;
                padding: 10px 0;
                border-top: 1px solid #f0f0f0;
                margin-top: auto;
            }
            
            /* 回到底部按钮样式 - 修改位置确保在对话框外 */
            .scroll-to-bottom-button {
                position: fixed;
                bottom: 100px;
                right: 20px;
                width: 40px;
                height: 40px;
                border-radius: 20px;
                background-color: #ff6b9d;
                color: white;
                border: none;
                box-shadow: 0 2px 10px rgba(255, 107, 157, 0.3);
                cursor: pointer;
                display: none;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                opacity: 0;
                transform: translateY(10px);
                transition: opacity 0.3s, transform 0.3s;
            }
            
            .scroll-to-bottom-button.visible {
                opacity: 1;
                transform: translateY(0);
            }
            
            .scroll-to-bottom-button:hover {
                background-color: #ff5690;
                transform: translateY(-2px);
            }
        `;
        document.head.appendChild(style);
    }
    
    tabContentElement.innerHTML = `
        <div class="ai-summary-chat-container">
            <div class="ai-chat-header">
                <button id="copy-chat-history" class="ai-chat-history-btn" title="复制全部对话">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    复制对话
                </button>
            </div>
            <div class="ai-summary-chat-history" id="ai-chat-history"></div>
            <div class="ai-summary-chat-input">
                <div class="ai-chat-input-area">
                    <textarea id="ai-chat-input" placeholder="有什么想问的..." rows="1"></textarea>
                    <button id="ai-chat-send" title="发送">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // 缓存聊天相关元素
    chatHistoryElement = document.getElementById('ai-chat-history');
    chatInputElement = document.getElementById('ai-chat-input');
    chatSendButtonElement = document.getElementById('ai-chat-send');
    
    // 渲染历史记录
    renderChatHistory();
    
    // 添加监听器
    chatSendButtonElement?.addEventListener('click', handleChatSend);
    chatInputElement?.addEventListener('keypress', handleChatInputKeyPress);
    
    // 添加复制整个对话的功能
    const copyHistoryBtn = document.getElementById('copy-chat-history');
    if (copyHistoryBtn) {
        copyHistoryBtn.addEventListener('click', () => {
            copyEntireChatHistory(copyHistoryBtn);
        });
    }
    
    // 如果聊天当前正在加载，显示加载状态
    // 注意：以下行直接调用setLoadingState会导致额外的loading元素被创建
    // 仅当状态标记为加载中且目标为askQuestion时，仅设置UI元素而不再添加新的加载元素
    if (isRequestPending && currentStreamTarget === 'askQuestion') {
        console.log("聊天已经处于加载状态，不再创建新的加载元素");
        // 仅显示通知，不再添加新的loading元素
        showNotification("AI 正在回复...", "info");
    }
    
    // 在渲染完成后设置滚动监听器
    setTimeout(() => {
        setupScrollListeners();
        // 重置滚动状态
        userHasScrolled = false;
        autoScroll = true;
    }, 100);
}

// 复制整个对话内容
function copyEntireChatHistory(button) {
    // 如果没有对话记录，显示提示
    if (!chatMessages || chatMessages.length === 0) {
        showNotification('没有对话内容可复制', 'info');
        return;
    }
    
    // 构建对话文本，格式化为人类可读形式
    let chatText = '';
    
    chatMessages.forEach(msg => {
        if (msg.role === 'user') {
            chatText += `问：${msg.content}\n\n`;
        } else if (msg.role === 'assistant') {
            chatText += `答：${msg.content}\n\n`;
        }
    });
    
    // 复制到剪贴板并显示样式反馈
    copyText(chatText, button);
    showNotification('已复制全部对话到剪贴板', 'success');
    
    // 添加视觉效果，表明复制了全部对话
    if (chatHistoryElement) {
        chatHistoryElement.classList.add('copy-highlight');
        setTimeout(() => {
            chatHistoryElement.classList.remove('copy-highlight');
        }, 300);
    }
}

function renderChatHistory() {
    if (!chatHistoryElement) return;
    chatHistoryElement.innerHTML = ''; // 清除现有内容
    chatMessages.forEach(msg => {
        appendChatMessage(msg.role, msg.content);
    });
    scrollToChatBottom();
}

function appendChatMessage(role, content, isLoading = false) {
    if (!chatHistoryElement) return;
    const msgEl = document.createElement('div');
    msgEl.classList.add('ai-chat-message');
    msgEl.classList.add(role === 'user' ? 'ai-chat-user' : 'ai-chat-ai');
    
    if (isLoading) {
        msgEl.id = 'ai-chat-loading';
        msgEl.innerHTML = '<div class="ai-summary-spinner"></div><div class="ai-chat-loading-text">思考中...</div>';
    } else {
        // 使用Markdown渲染AI回复，但用户消息仍保持纯文本
        if (role === 'assistant') {
            // AI回复消息，添加复制按钮
            msgEl.innerHTML = `
                <div class="ai-chat-content">${renderMarkdown(content)}</div>
                <div class="ai-chat-actions">
                    <button class="ai-chat-copy-btn" title="复制回复">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                </div>
            `;
        } else {
            // 用户消息，添加编辑按钮
            msgEl.innerHTML = `
                <div class="ai-chat-content">${escapeHtml(content)}</div>
                <div class="ai-chat-actions">
                    <button class="ai-chat-edit-btn" title="编辑提问">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                        </svg>
                    </button>
                </div>
            `;
        }
    }
    
    chatHistoryElement.appendChild(msgEl);
    
    // 设置按钮事件监听器
    if (!isLoading) {
        if (role === 'assistant') {
            const copyBtn = msgEl.querySelector('.ai-chat-copy-btn');
            if (copyBtn) {
                copyBtn.addEventListener('click', () => {
                    copyText(content, copyBtn);
                });
            }
        } else {
            const editBtn = msgEl.querySelector('.ai-chat-edit-btn');
            if (editBtn) {
                editBtn.addEventListener('click', () => {
                    editChatMessage(content, msgEl);
                });
            }
        }
    }
    
    scrollToChatBottom();
    return msgEl; // 返回元素，以防我们需要更新它（用于流式处理）
}

// 复制文本到剪贴板
function copyText(text, button = null) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('内容已复制到剪贴板', 'success', 1500);
        
        // 如果提供了按钮元素，添加复制成功动画
        if (button) {
            button.classList.add('copy-success');
            setTimeout(() => {
                button.classList.remove('copy-success');
            }, 500);
        }
    }).catch(err => {
        console.error('复制失败:', err);
        showNotification('复制失败', 'error');
    });
}

// 编辑聊天消息
function editChatMessage(originalText, messageElement) {
    if (!chatInputElement) return;
    
    // 将消息内容填入输入框
    chatInputElement.value = originalText;
    
    // 调整输入框高度
    chatInputElement.style.height = 'auto';
    const newHeight = Math.min(chatInputElement.scrollHeight, 150);
    chatInputElement.style.height = newHeight + 'px';
    
    // 启用发送按钮
    if (chatSendButtonElement) {
        chatSendButtonElement.disabled = false;
    }
    
    // 闪烁输入框以提示用户
    chatInputElement.classList.add('input-flash');
    setTimeout(() => {
        chatInputElement.classList.remove('input-flash');
    }, 1000);
    
    // 聚焦输入框
    chatInputElement.focus();
    
    // 删除原消息以及后续的对话
    let foundMsg = false;
    const messagesToRemove = [];
    
    // 找到消息元素后的所有聊天内容
    Array.from(chatHistoryElement.children).forEach(el => {
        if (foundMsg || el === messageElement) {
            foundMsg = true;
            messagesToRemove.push(el);
        }
    });
    
    // 从DOM中删除元素
    messagesToRemove.forEach(el => el.remove());
    
    // 从聊天历史数组中也删除对应的消息
    for (let i = chatMessages.length - 1; i >= 0; i--) {
        if (chatMessages[i].role === 'user' && chatMessages[i].content === originalText) {
            chatMessages.splice(i);
            break;
        }
    }
}

function scrollToChatBottom() {
    if (chatHistoryElement) {
        // 暂时移除滚动监听器
        const originalScrollHandler = chatHistoryElement.onscroll;
        chatHistoryElement.onscroll = null;
        
        // 使用更可靠的滚动方法
        setTimeout(() => {
            chatHistoryElement.scrollTop = chatHistoryElement.scrollHeight;
            
            // 确保父级容器也滚动到底部
            let parentContainer = document.querySelector('.ai-summary-chat-container');
            if (parentContainer) {
                parentContainer.scrollTop = parentContainer.scrollHeight;
            }
            
            // 如果有tab内容容器也滚动
            if (tabContentElement) {
                tabContentElement.scrollTop = tabContentElement.scrollHeight;
            }
            
            // 确保主内容容器也滚动
            let mainContainer = document.querySelector('#ai-summary-tab-content');
            if (mainContainer) {
                mainContainer.scrollTop = mainContainer.scrollHeight;
            }
            
            // 恢复滚动监听器
            setTimeout(() => {
                chatHistoryElement.onscroll = originalScrollHandler;
            }, 100);
        }, 10); // 小延迟确保DOM已更新
    }
}

function updateStreamingChatMessage(content) {
    if (!chatHistoryElement) return;
    
    const loadingEl = chatHistoryElement.querySelector('#ai-chat-loading');
    if (loadingEl) {
        // 清除加载状态ID以防止重复更新
        loadingEl.id = '';
        // 清除加载内容并添加带复制按钮的内容
        loadingEl.innerHTML = `
            <div class="ai-chat-content">${renderMarkdown(content)}</div>
            <div class="ai-chat-actions">
                <button class="ai-chat-copy-btn" title="复制回复">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                </button>
            </div>
        `;
        
        // 添加复制按钮事件监听
        const copyBtn = loadingEl.querySelector('.ai-chat-copy-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                copyText(content, copyBtn);
            });
        }
        
        // 智能滚动控制：只有在用户没有手动滚动时才自动滚动
        if (autoScroll && !userHasScrolled) {
            scrollToChatBottom();
        }
    } else {
        // 如果加载指示器已消失，找到最后一条 AI 消息
        const aiMessages = chatHistoryElement.querySelectorAll('.ai-chat-ai');
        if (aiMessages.length > 0) {
            const lastAiMsg = aiMessages[aiMessages.length - 1];
            const contentDiv = lastAiMsg.querySelector('.ai-chat-content');
            if (contentDiv) {
                contentDiv.innerHTML = renderMarkdown(content);
                
                // 更新复制按钮事件，确保复制最新内容
                const copyBtn = lastAiMsg.querySelector('.ai-chat-copy-btn');
                if (copyBtn) {
                    // 移除旧事件监听器(通过克隆替换)
                    const newCopyBtn = copyBtn.cloneNode(true);
                    copyBtn.parentNode.replaceChild(newCopyBtn, copyBtn);
                    
                    // 添加新事件监听
                    newCopyBtn.addEventListener('click', () => {
                        copyText(content, newCopyBtn);
                    });
                }
                
                // 智能滚动控制
                if (autoScroll && !userHasScrolled) {
                    scrollToChatBottom();
                }
            } else {
                lastAiMsg.innerHTML = `
                    <div class="ai-chat-content">${renderMarkdown(content)}</div>
                    <div class="ai-chat-actions">
                        <button class="ai-chat-copy-btn" title="复制回复">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                        </button>
                    </div>
                `;
                
                // 添加复制按钮事件监听
                const copyBtn = lastAiMsg.querySelector('.ai-chat-copy-btn');
                if (copyBtn) {
                    copyBtn.addEventListener('click', () => {
                        copyText(content, copyBtn);
                    });
                }
                
                // 智能滚动控制
                if (autoScroll && !userHasScrolled) {
                    scrollToChatBottom();
                }
            }
        } else {
            // 如果没有找到AI消息，创建一个新的
            appendChatMessage('assistant', content);
        }
    }
}

// --- 状态管理与后台通信（需移动/调整） ---

function populateModelDropdown() {
   // 从后台获取模型并填充选择框
   chrome.runtime.sendMessage({ action: "getModels" }, (response) => {
        if (response && response.models) {
            modelListCache = response.models;
            modelSelectElement.innerHTML = '<option value="">选择模型...</option>'; // 清除现有内容
            response.models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.name;
                modelSelectElement.appendChild(option);
            });
             // 从存储中恢复选择
            chrome.storage.sync.get(['selectedModelId'], (result) => {
                if (result.selectedModelId && response.models.some(m => m.id === result.selectedModelId)) {
                    currentModelId = result.selectedModelId;
                    modelSelectElement.value = currentModelId;
                } else if (response.models.length > 0) {
                    currentModelId = response.models[0].id;
                    modelSelectElement.value = currentModelId;
                } else {
                    currentModelId = null;
                }
                console.log(`侧边栏模型设置为: ${currentModelId}`);
            });
        } else {
            console.error("侧边栏: 未能获取模型列表");
        }
    });
}

function handleModelChange(event) {
    currentModelId = event.target.value;
    console.log(`侧边栏模型已更改为: ${currentModelId}`);
    chrome.storage.sync.set({ selectedModelId: currentModelId });
    // 待办：决定更改模型是否应清除状态
}

function openOptionsPage() {
    chrome.runtime.sendMessage({ action: "openOptions" });
}

function setLoadingState(isLoading, message = '', targetTab = null) {
     // ... (keep existing logging and isRequestPending/currentStreamTarget management)

     isRequestPending = isLoading;
     if (isLoading) { 
         currentStreamTarget = targetTab;
     } 

     console.log(`[setLoadingState] isLoading: ${isLoading}, targetTab: ${targetTab}, currentStreamTarget: ${currentStreamTarget}, currentVisibleTab: ${currentTab}`);

    // Determine the tab name corresponding to the action
    let actionTabName = null;
    if (targetTab === 'getSummary') actionTabName = 'summary';
    else if (targetTab === 'getPlainSummary') actionTabName = 'plain';
    else if (targetTab === 'askQuestion') actionTabName = 'chat';
    
    // 仅当加载状态适用于当前查看的标签时才在视觉上更新 UI
    if (actionTabName && currentTab === actionTabName) {
        console.log(`[setLoadingState] Target action ${targetTab} matches current tab ${currentTab}. Updating UI.`);
        if (isLoading) {
            // 确保 tabContentElement 存在
            if (!tabContentElement) {
                console.error("[setLoadingState] tabContentElement is null. Cannot update UI.");
                return;
            }
            
            if (targetTab === 'askQuestion') { 
                // 对于聊天，不在setLoadingState中创建加载指示器，而是在sendChatMessage中创建
                // 避免重复创建"思考中..."消息框
                console.log("[setLoadingState] 聊天加载状态将在sendChatMessage中处理，跳过");
                return;
            } else {
                // 检查是否已经存在内容div，避免创建重复的容器
                let contentDiv = tabContentElement.querySelector('.content');
                
                // 对于总结/大白话，替换内容
                // 设置加载HTML，并确保只创建一个 .content div
                if (!contentDiv) {
                    let loadingHTML = `
                        <div class="ai-summary-loading">
                            <div class="ai-summary-spinner"></div>
                            <p>${message || '正在处理中...'}</p> 
                        </div>
                        <div class="content"></div> 
                    `;
                    tabContentElement.innerHTML = loadingHTML;
                } else {
                    // 如果已经有内容div，只添加加载指示器
                    let loadingDiv = tabContentElement.querySelector('.ai-summary-loading');
                    if (!loadingDiv) {
                        loadingDiv = document.createElement('div');
                        loadingDiv.className = 'ai-summary-loading';
                        loadingDiv.innerHTML = `
                            <div class="ai-summary-spinner"></div>
                            <p>${message || '正在处理中...'}</p>
                        `;
                        tabContentElement.insertBefore(loadingDiv, contentDiv);
                    }
                }
            }
        } else {
            // 加载完成状态主要由 handleStreamEnd/Error 重新渲染内容处理。
            // 我们只需要在这里删除任何特定的加载指示器。
            if (targetTab === 'askQuestion') {
                const loadingIndicator = chatHistoryElement?.querySelector('#ai-chat-loading');
                if (loadingIndicator) {
                    loadingIndicator.remove();
                }
            } 
            // 对于总结/大白话，renderXTab 会替换内容，但我们可以尝试移除加载动画以防万一
            const loadingDiv = tabContentElement?.querySelector('.ai-summary-loading');
            if(loadingDiv) loadingDiv.remove();
        }
    } else {
        console.log(`[setLoadingState] Target action ${targetTab} does not match current tab ${currentTab}. Skipping visual UI update.`);
    }
}

// --- 动作触发器（从后台请求） ---

async function requestFormalSummary(isVideo = false) { // 添加 isVideo 参数
     if (isRequestPending) { 
         showNotification("已有请求正在进行中...", "info");
         return; 
     }
     if (!currentModelId) { 
         showNotification("请先选择模型", "error");
         return; 
     }
     
     const loadingMessage = isVideo ? "正在分析视频..." : "正在生成总结...";
     setLoadingState(true, loadingMessage, 'getSummary');
     showNotification(isVideo ? "已开始分析视频..." : "已开始生成总结...", "info");
     accumulatedStreamContent = '';
     originalSummary = ''; // 清除之前的摘要

    // 需要页面内容或视频字幕 - 询问后台
    chrome.runtime.sendMessage({ 
        action: "getPageContentForAction", 
        requestedAction: "getSummary", 
        modelId: currentModelId, 
        isVideo: isVideo // <--- 传递 isVideo 标志
    }, (response) => {
        if (response && response.success) {
            console.log(`侧边栏已接收确认，后台现在将为 ${isVideo ? '视频分析' : '页面总结'} 调用 API。`);
            // 后台将处理 API 调用并发回流
        } else {
            console.error(`侧边栏: 无法启动 getSummary (isVideo=${isVideo}) -`, response?.error);
            setLoadingState(false, '', 'getSummary'); // 注意: targetAction 应为 getSummary
            // 使用handleStreamError来显示错误和重试按钮
            handleStreamError(response?.error || '未知错误', 'getSummary');
        }
    });
}

async function requestPlainSummary(isVideo = false) { // 添加 isVideo 参数
     if (isRequestPending) { 
         showNotification("已有请求正在进行中...", "info");
         return; 
     }
     if (!currentModelId) { 
         showNotification("请先选择模型", "error");
         return; 
     }

     const loadingMessage = isVideo ? "生成视频大白话..." : "正在生成大白话版本...";
     setLoadingState(true, loadingMessage, 'getPlainSummary');
     showNotification(isVideo ? "已开始生成视频大白话..." : "已开始生成大白话版本...", "info");
     accumulatedStreamContent = '';
     plainLanguageSummary = ''; // 清除之前的内容

    // 需要页面内容或视频字幕 - 询问后台
    chrome.runtime.sendMessage({ 
        action: "getPageContentForAction", 
        requestedAction: "getPlainSummary", 
        modelId: currentModelId, 
        isVideo: isVideo // <--- 传递 isVideo 标志
    }, (response) => {
         if (response && response.success) {
            console.log(`侧边栏已收到确认，后台现在将为 ${isVideo ? '视频大白话' : '页面大白话'} 调用 API。`);
        } else {
            console.error(`侧边栏: 无法启动 getPlainSummary (isVideo=${isVideo}) -`, response?.error);
            setLoadingState(false, '', 'getPlainSummary');
             // 使用handleStreamError来显示错误和重试按钮
             handleStreamError(response?.error || '未知错误', 'getPlainSummary');
        }
    });
}

function handleChatSend() {
    // 获取当前输入值
    if (!chatInputElement) {
        console.error("聊天输入框元素不存在");
        return;
    }
    
    // 检查输入是否为空
    const message = chatInputElement.value.trim();
    if (!message) {
        return;
    }
    
    // 使用发送消息函数
    sendChatMessage(message);
}

function handleChatInputKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault(); 
        handleChatSend();
    }
}

// --- 来自后台的消息处理 ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("[侧边栏] 收到消息:", JSON.stringify(message));

    switch (message.action) {
        case 'streamChunk':
            console.log(`[侧边栏] handleStreamChunk 为操作调用: ${message.requestAction} 带块: [${message.chunk}]`);
            handleStreamChunk(message.chunk, message.requestAction);
            break;
        case 'streamEnd':
            console.log(`[侧边栏] handleStreamEnd 为操作调用: ${message.requestAction}`);
            handleStreamEnd(true, message.requestAction);
            break;
        case 'streamError':
             console.error(`[侧边栏] handleStreamError 为操作调用: ${message.requestAction}, 错误: ${message.error}`);
            handleStreamError(message.error, message.requestAction);
            break;
         case 'contextActionTriggered': // 处理从上下文菜单触发的操作
             console.log("[侧边栏] 上下文操作已触发:", message.detail);
             handleContextAction(message.detail);
             break;
         case 'updateSidebarState': // 后台发送缓存状态或初始状态
             console.log("[侧边栏] 收到状态更新:", message.state);
             restoreState(message.state);
             break;
        case 'pageChanged': // 处理页面变更消息
            if (message.url) {
                console.log("[侧边栏] 检测到页面变更:", message.url);
                // 检查是否真的是新页面URL
                if (message.url !== currentPageUrl) {
                    showPageChangePrompt(message.url);
                    // 不再立即清空内容状态
                    // originalSummary = '';
                    // plainLanguageSummary = '';
                    // chatMessages = [];
                    // 根据当前标签更新UI
                    switchTab(currentTab);
                }
            }
            break;
        case 'quickAction': // 处理快速操作消息
            handleQuickAction(message.actionType);
            break;
        default:
             console.log("[侧边栏] 忽略未知消息操作:", message.action);
    }
    // 除非异步使用 sendResponse（在这里我们没有），否则不返回任何内容或返回 false 通常是安全的。
});

function handleStreamChunk(chunk, targetAction) {
    // 检查是否有效的请求行为
    if (!targetAction) {
        console.error('Received chunk with undefined targetAction', chunk);
        return;
    }
    
    // 累加流内容
    accumulatedStreamContent += chunk;
    
    // 为聊天消息单独处理
    if (targetAction === "askQuestion") {
        updateStreamingChatMessage(accumulatedStreamContent);
        if (autoScroll && !userHasScrolled) {
            scrollToChatBottom();
        }
        return; // 聊天单独处理，不需要下面的通用逻辑
    }
    
    // 确保目标内容元素存在
    let targetElement;
    const contentSelector = '#ai-summary-tab-content .content'; 
    
    if (targetAction === "getSummary") {
        targetElement = document.querySelector(contentSelector);
        if (!targetElement) {
            if(currentTab === 'summary') {
                console.warn(`[StreamChunk] Target element not found for summary. Attempting re-render.`);
                renderSummaryTab(); 
                targetElement = document.querySelector(contentSelector);
            }
        }
    } else if (targetAction === "getPlainSummary") {
        targetElement = document.querySelector(contentSelector);
        if (!targetElement) {
             if(currentTab === 'plain') {
                console.warn(`[StreamChunk] Target element not found for plain. Attempting re-render.`);
                renderPlainTab(); 
                targetElement = document.querySelector(contentSelector);
            }
        }
    } else if (targetAction === "infoMessage") {
         // 信息提示也有单独逻辑
        console.log("收到提示信息:", chunk);
        try {
            let infoContainer = document.getElementById('info-message-container');
            if (!infoContainer) {
                infoContainer = document.createElement('div');
                infoContainer.id = 'info-message-container';
                infoContainer.className = 'info-message';
                 const currentTabContentContainer = document.getElementById('ai-summary-tab-content');
                 if (currentTabContentContainer) {
                    currentTabContentContainer.prepend(infoContainer);
                 } else { 
                     console.error("Cannot find main tab content container for info message.");
                     document.body.prepend(infoContainer); // Fallback to body
                 }
            }
            if (infoContainer && infoContainer.parentNode) {
                infoContainer.innerHTML = renderMarkdown(chunk) || '';
            } else {
                 console.error("无法设置提示信息，容器未附加到DOM");
            }
        } catch (error) {
            console.error("处理提示信息时出错:", error);
        }
        return;
    } else {
        console.warn('Unhandled targetAction in handleStreamChunk:', targetAction);
        return;
    }

    // 更新内容区域 - 实时流式输出
    if (targetElement) {
        // 优化：只在内容实际变化时更新innerHTML，并确保滚动
        const renderedHTML = renderMarkdown(accumulatedStreamContent);
        // 避免不必要的DOM操作
        if (targetElement.innerHTML !== renderedHTML) {
            targetElement.innerHTML = renderedHTML;
            
            // 只有当用户没有手动滚动时，才自动滚动
            if (autoScroll && !userHasScrolled) {
                // 滚动内容元素到底部
                targetElement.scrollTop = targetElement.scrollHeight;
                
                // 同时确保整个tab内容区域滚动
                if (tabContentElement) {
                    tabContentElement.scrollTop = tabContentElement.scrollHeight;
                }
                
                // 最后确保如果有外层滚动容器也滚动
                let mainContainer = document.querySelector('.ai-summary-tab-content');
                if (mainContainer) {
                    mainContainer.scrollTop = mainContainer.scrollHeight;
                }
            }
        }
    } else {
         console.warn(`流式更新失败：未找到目标元素 for action ${targetAction} using selector '${contentSelector}'`);
    }
}

function handleStreamEnd(success, targetAction) {
    // 安全检查：确保我们结束的是正确的流
    if (targetAction !== currentStreamTarget) {
        console.warn(`[侧边栏 handleStreamEnd] 收到 ${targetAction} 的结束信号，但当前目标是 ${currentStreamTarget}。忽略。`);
        return; 
    }
    
    console.log(`[侧边栏 handleStreamEnd] ${targetAction} 的流已结束。成功: ${success}`);
    const finalContent = accumulatedStreamContent;
    
    // 检查是否有实际内容
    const hasContent = finalContent && finalContent.trim().length > 0;
    
    // 只有在成功且有内容时才处理为成功
    if (success && hasContent) {
        if (targetAction === 'getSummary') {
            originalSummary = finalContent;
            
            // 清除加载状态
            setLoadingState(false, '', targetAction);
            
            // 平滑过渡：检查是否存在已有的内容元素
            let loadingEl = tabContentElement?.querySelector('.ai-summary-loading');
            let contentEl = tabContentElement?.querySelector('.ai-summary-text');
            
            if (contentEl) {
                // 内容元素已存在，先移除加载元素，然后更新内容和添加按钮
                if (loadingEl) {
                    loadingEl.remove();
                }
                
                // 确保内容被正确更新
                contentEl.innerHTML = renderMarkdown(finalContent);
                
                // 添加重新生成按钮
                if (!tabContentElement.querySelector('#generate-summary-btn')) {
                    const btnEl = document.createElement('button');
                    btnEl.id = 'generate-summary-btn';
                    btnEl.className = 'ai-summary-regenerate-btn';
                    btnEl.textContent = '重新生成总结';
                    btnEl.addEventListener('click', requestFormalSummary);
                    tabContentElement.appendChild(btnEl);
                }
            } else {
                // 内容元素不存在，使用标准的渲染函数
                renderSummaryTab();
            }
            
            showNotification('总结生成完成！', 'success');
        } else if (targetAction === 'getPlainSummary') {
            plainLanguageSummary = finalContent;
            
            // 清除加载状态
            setLoadingState(false, '', targetAction);
            
            // 平滑过渡：检查是否存在已有的内容元素
            let loadingEl = tabContentElement?.querySelector('.ai-summary-loading');
            let contentEl = tabContentElement?.querySelector('.ai-summary-text');
            
            if (contentEl) {
                // 内容元素已存在，先移除加载元素，然后更新内容和添加按钮
                if (loadingEl) {
                    loadingEl.remove();
                }
                
                // 确保内容被正确更新
                contentEl.innerHTML = renderMarkdown(finalContent);
                
                // 添加重新生成按钮
                if (!tabContentElement.querySelector('#generate-plain-btn')) {
                    const btnEl = document.createElement('button');
                    btnEl.id = 'generate-plain-btn';
                    btnEl.className = 'ai-summary-regenerate-btn';
                    btnEl.textContent = '重新生成大白话';
                    btnEl.addEventListener('click', requestPlainSummary);
                    tabContentElement.appendChild(btnEl);
                }
            } else {
                // 内容元素不存在，使用标准的渲染函数
                renderPlainTab();
            }
            
            showNotification('大白话版本生成完成！', 'success');
        } else if (targetAction === 'askQuestion') {
            // 清除加载状态
            setLoadingState(false, '', targetAction);
            
            // 保存最终回复到聊天历史
            chatMessages.push({ role: 'assistant', content: finalContent });
            
            // 确保聊天消息被正确更新
            const loadingEl = chatHistoryElement?.querySelector('#ai-chat-loading');
            if (loadingEl) {
                loadingEl.id = ''; // 移除loading ID
                loadingEl.innerHTML = renderMarkdown(finalContent);
            } else {
                console.log("流已结束但找不到正在加载的消息元素");
            }
            
            showNotification('问题回答完成！', 'success');
        }
        // 保存最终状态
        chrome.runtime.sendMessage({ action: "saveState", state: { summary: originalSummary, plainSummary: plainLanguageSummary, chatHistory: chatMessages, modelId: currentModelId } });
    } else {
        // 如果没有内容，视为错误
        console.warn(`[侧边栏 handleStreamEnd] ${targetAction} 的流结束但没有内容。视为错误。`);
        handleStreamError("生成内容失败，请重试", targetAction);
    }
    
    // 在所有处理完成后重置流状态和加载状态
    isRequestPending = false;
    accumulatedStreamContent = '';
    currentStreamTarget = null; // <<< 移到末尾
    console.log(`[侧边栏 handleStreamEnd] ${targetAction} 的状态已重置。currentStreamTarget 现在为空。`);
}

function handleStreamError(error, targetAction) {
    // 安全检查：确保我们处理正确流的错误
    if (targetAction !== currentStreamTarget) { 
        console.warn(`[侧边栏 handleStreamError] 收到 ${targetAction} 的错误，但当前目标是 ${currentStreamTarget}。忽略。`);
        return;
    }
     
    console.error(`[侧边栏 handleStreamError] ${targetAction} 的流错误:`, error);
     
    // 调用 setLoadingState 移除加载 UI，但确保 currentStreamTarget 在结束前保持有效
    setLoadingState(false, '', targetAction);

    // 在 UI 中显示错误并添加重新生成按钮
    // 根据 isVideo 状态调整重试函数
    const isBiliVideo = currentPageUrl && currentPageUrl.includes('bilibili.com/video/');
    
    if (targetAction === 'getSummary') {
        if(tabContentElement) {
            const retryFunction = isBiliVideo ? () => requestFormalSummary(true) : () => requestFormalSummary(false);
            const buttonText = isBiliVideo ? '重新分析视频' : '重新生成总结';
            const errorHtml = `
                <div class="ai-summary-error-container">
                    <p class="ai-summary-error">${isBiliVideo ? '视频分析失败' : '生成失败'}: ${escapeHtml(error) || '未知错误'}</p>
                    <button id="retry-summary-btn" class="ai-retry-button">${buttonText}</button>
                </div>`;
            tabContentElement.innerHTML = errorHtml;
            
            // 添加重新生成按钮事件
            setTimeout(() => {
                const retryButton = document.getElementById('retry-summary-btn');
                if (retryButton) {
                    retryButton.addEventListener('click', retryFunction);
                }
            }, 0);
        }
    } else if (targetAction === 'getPlainSummary') {
        if(tabContentElement) {
            const retryFunction = isBiliVideo ? () => requestPlainSummary(true) : () => requestPlainSummary(false);
            const buttonText = isBiliVideo ? '重新生成视频大白话' : '重新生成大白话';
            const errorHtml = `
                <div class="ai-summary-error-container">
                    <p class="ai-summary-error">${isBiliVideo ? '生成视频大白话失败' : '生成失败'}: ${escapeHtml(error) || '未知错误'}</p>
                    <button id="retry-plain-btn" class="ai-retry-button">${buttonText}</button>
                </div>`;
            tabContentElement.innerHTML = errorHtml;
            
            // 添加重新生成按钮事件
            setTimeout(() => {
                const retryButton = document.getElementById('retry-plain-btn');
                if (retryButton) {
                    retryButton.addEventListener('click', retryFunction);
                }
            }, 0);
        }
    } else if (targetAction === 'askQuestion') {
        // 查找并删除"思考中"状态的消息
        const loadingEl = chatHistoryElement?.querySelector('#ai-chat-loading');
        if (loadingEl) {
            loadingEl.remove();
        }
        
        // 添加错误消息
        const errorMessage = `错误: ${escapeHtml(error) || '未知错误'}`;
        const errorEl = appendChatMessage('assistant', errorMessage);
        if (errorEl) {
            errorEl.classList.add('ai-chat-error-message');
        }
        
        // 删除错误消息的role='assistant'条目，因为这不是有效的AI回复
        if (chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === 'assistant') {
            chatMessages.pop();
        }
        
        // 添加重试按钮
        if (chatHistoryElement) {
            const lastMessage = chatMessages.length > 0 ? 
                chatMessages[chatMessages.length - 1] : null;
                
            if (lastMessage && lastMessage.role === 'user') {
                const retryButtonContainer = document.createElement('div');
                retryButtonContainer.className = 'ai-chat-retry-container';
                retryButtonContainer.innerHTML = `<button class="ai-chat-retry-button">重新提问</button>`;
                chatHistoryElement.appendChild(retryButtonContainer);
                
                // 添加重试事件
                const retryButton = retryButtonContainer.querySelector('.ai-chat-retry-button');
                if (retryButton) {
                    retryButton.addEventListener('click', () => {
                        // 移除错误消息和重试按钮
                        const errorMessages = chatHistoryElement.querySelectorAll('.ai-chat-error-message');
                        errorMessages.forEach(el => el.remove());
                        retryButtonContainer.remove();
                        
                        // 重新发送最后一条用户消息
                        const userMessage = lastMessage.content;
                        sendChatMessage(userMessage);
                    });
                }
            }
        }
    }
    
    // 添加CSS样式
    if (!document.getElementById('error-retry-styles')) {
        const style = document.createElement('style');
        style.id = 'error-retry-styles';
        style.textContent = `
            .ai-summary-error-container {
                padding: 16px;
                border-radius: 10px;
                background-color: #fff0f5;
                margin: 10px 0;
                text-align: center;
                border-left: 4px solid #ff6b9d;
            }
            .ai-summary-error {
                color: #ff5090;
                margin-bottom: 12px;
                font-size: 14px;
            }
            .ai-retry-button {
                background-color: #ff6b9d;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 500;
                transition: all 0.2s ease;
                box-shadow: 0 2px 4px rgba(255, 107, 157, 0.2);
            }
            .ai-retry-button:hover {
                background-color: #ff5090;
                transform: translateY(-1px);
                box-shadow: 0 4px 8px rgba(255, 107, 157, 0.3);
            }
            .ai-retry-button:active {
                transform: translateY(1px);
                box-shadow: 0 1px 2px rgba(255, 107, 157, 0.2);
            }
            .ai-chat-retry-container {
                display: flex;
                justify-content: center;
                margin: 10px 0;
            }
            .ai-chat-retry-button {
                background-color: #fff0f5;
                color: #ff6b9d;
                border: 1px solid #ffd6e6;
                padding: 7px 14px;
                border-radius: 20px;
                cursor: pointer;
                font-size: 13px;
                transition: all 0.2s ease;
            }
            .ai-chat-retry-button:hover {
                background-color: #ffd6e6;
                transform: translateY(-1px);
            }
            .ai-chat-retry-button:active {
                transform: translateY(1px);
            }
        `;
        document.head.appendChild(style);
    }
    
    // 显示错误通知
    showNotification(`操作失败: ${error || '未知错误'}`, 'error');
    
    // 在所有处理完成后重置流状态和加载状态
    isRequestPending = false;
    accumulatedStreamContent = '';
    currentStreamTarget = null;
    console.log(`[侧边栏 handleStreamError] ${targetAction} 的状态已重置。currentStreamTarget 现在为空。`);
}

// 添加发送聊天消息的辅助函数
function sendChatMessage(message) {
    // 如果当前有请求正在进行，则不允许发送
    if (isRequestPending) {
        showNotification('请等待当前回复完成', 'info');
        return;
    }
    
    // 添加用户消息到UI并保存到历史记录
    appendChatMessage('user', message);
    chatMessages.push({ role: 'user', content: message });
    
    // 添加AI思考中状态 - 确保ID是唯一的
    const loadingMessageEl = appendChatMessage('assistant', '', true);
    
    // 重置流式内容
    accumulatedStreamContent = '';
    
    // 设置状态变量，但不创建新的加载指示器
    isRequestPending = true;
    currentStreamTarget = 'askQuestion';
    
    // 检测当前是否为B站视频页面
    const isBilibiliVideo = currentPageUrl && currentPageUrl.includes('bilibili.com/video/');
    
    // 发送请求到后台脚本 - 使用getPageContentForAction获取内容
    chrome.runtime.sendMessage({
        action: 'getPageContentForAction',
        requestedAction: 'askQuestion',
        question: message,
        chatHistory: chatMessages.slice(0, -1), // 排除最后一条消息，因为它已包含在question中
        modelId: currentModelId || 'default',
        isVideo: isBilibiliVideo // 传递是否为视频页面的标志
    }, response => {
        if (!response || !response.success) {
            // 如果请求失败立即处理
            handleStreamError(response?.error || '发送请求失败', 'askQuestion');
        }
    });
    
    // 清空输入框并禁用发送按钮
    if (chatInputElement) {
        chatInputElement.value = '';
        chatInputElement.focus();
    }
    
    if (chatSendButtonElement) {
        chatSendButtonElement.disabled = true;
        // 1秒后重新启用按钮
        setTimeout(() => {
            if (chatSendButtonElement) chatSendButtonElement.disabled = false;
        }, 1000);
    }
    
    // 滚动到底部
    scrollToChatBottom();
    
    // 重置滚动控制状态
    userHasScrolled = false;
    autoScroll = true;
}

function setupChatEvents() {
    if (!chatInputElement || !chatSendButtonElement) return;
    
    // 设置发送按钮点击事件
    chatSendButtonElement.addEventListener('click', handleChatSend);
    
    // 设置输入框事件
    chatInputElement.addEventListener('keypress', handleChatInputKeyPress);
    
    // 自动调整高度
    chatInputElement.addEventListener('input', () => {
        // 重置高度
        chatInputElement.style.height = 'auto';
        
        // 设置新高度（最大150px）
        const newHeight = Math.min(chatInputElement.scrollHeight, 150);
        chatInputElement.style.height = newHeight + 'px';
        
        // 禁用或启用发送按钮
        if (chatSendButtonElement) {
            chatSendButtonElement.disabled = !chatInputElement.value.trim();
        }
    });
    
    // 初始状态下禁用发送按钮
    if (chatSendButtonElement) {
        chatSendButtonElement.disabled = !chatInputElement.value.trim();
    }
}

// --- 辅助函数 ---
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }

// 处理从上下文菜单（右键菜单）触发的操作
function handleContextAction(detail) {
    if (!detail || !detail.type) return;
    
    console.log("处理上下文操作:", detail.type);
    
    if (detail.type === "explainSelection" && detail.text) {
        // 处理解释选定文本的操作
        console.log("解释选定文本:", detail.text.substring(0, 30) + "...");
        switchTab('plain');
        // 保存选定文本并请求解释
        chrome.runtime.sendMessage({ 
            action: "getPageContentForAction", 
            requestedAction: "getPlainSummary", 
            modelId: currentModelId,
            selectedText: detail.text
        });
    } else if (detail.type === "summarizePage") {
        // 处理总结页面的操作
        console.log("总结整个页面");
        switchTab('summary');
        requestFormalSummary();
    }
}

// 处理从后台恢复状态（例如从缓存加载）
function restoreState(state) {
    if (!state) return;
    
    console.log("从状态恢复中...");
    
    // 恢复内容状态
    if (state.summary) {
        originalSummary = state.summary;
        console.log("已恢复总结");
    }
    
    if (state.plainSummary) {
        plainLanguageSummary = state.plainSummary;
        console.log("已恢复大白话版本");
    }
    
    if (state.chatHistory && state.chatHistory.length > 0) {
        chatMessages = state.chatHistory;
        console.log("已恢复聊天历史:", chatMessages.length, "条消息");
    }
    
    // 恢复模型选择
    if (state.modelId && modelSelectElement) {
        currentModelId = state.modelId;
        modelSelectElement.value = currentModelId;
        console.log("已恢复模型选择:", currentModelId);
    }
    
    // 刷新当前视图
    switchTab(currentTab);
}

// 处理快速操作请求
function handleQuickAction(actionType) {
    console.log(`处理快速操作: ${actionType}`);
    
    if (actionType === "summarizeVideo") {
        // 确保切换到总结标签页
        switchTab('summary');
        
        // 立即触发视频分析请求 (isVideo=true)
        requestFormalSummary(true);
        
        // (可选) 可以在这里添加特定的视频分析加载提示信息，
        // 但 requestFormalSummary 内部的 setLoadingState 应该也能处理
    }
}

// 创建每个标签内容
function createTabContent(tab) {
    console.log(`创建标签内容: ${tab}`);
    // 清除原有内容
    tabContentElement.innerHTML = '';
    
    switch(tab) {
        case 'summary':
            // 判断当前是否为B站视频页
            const isBilibiliVideo = currentPageUrl && currentPageUrl.includes('bilibili.com/video/');
            
            if (isBilibiliVideo) {
                tabContentElement.innerHTML = `
                    <div class="ai-summary-action-area">
                        <button id="analyze-video-btn" class="ai-summary-action-button">
                            <span class="icon">🎬</span> 分析视频内容
                        </button>
                    </div>
                    <div class="info-message">
                        <p>检测到您正在浏览<em>B站视频</em>。</p>
                        <p>点击按钮分析视频内容，AI将根据视频字幕提供智能分析。</p>
                    </div>
                    <div id="summary-content" class="ai-summary-content"></div>
                `;
                // 监听分析视频按钮
                document.getElementById('analyze-video-btn').addEventListener('click', () => {
                    console.log("分析视频内容按钮被点击");
                    handleQuickAction('getSummary', true);
                });
            } else {
                // 普通网页
                tabContentElement.innerHTML = `
                    <div class="ai-summary-action-area">
                        <button id="generate-summary-btn" class="ai-summary-action-button">
                            <span class="icon">📝</span> 生成网页总结
                        </button>
                    </div>
                    <div class="info-message">
                        <p>点击按钮分析当前网页内容，AI将提取关键信息并生成总结。</p>
                    </div>
                    <div id="summary-content" class="ai-summary-content"></div>
                `;
                // 监听生成总结按钮
                document.getElementById('generate-summary-btn').addEventListener('click', () => {
                    console.log("生成总结按钮被点击");
                    handleQuickAction('getSummary', false);
                });
            }
            break;
            
        case 'plain':
            // 判断当前是否为B站视频页
            const isPlainBilibiliVideo = currentPageUrl && currentPageUrl.includes('bilibili.com/video/');
            
            if (isPlainBilibiliVideo) {
                tabContentElement.innerHTML = `
                    <div class="ai-summary-action-area">
                        <button id="generate-plain-btn" class="ai-summary-action-button">
                            <span class="icon">🗣️</span> 视频内容大白话
                        </button>
                    </div>
                    <div class="info-message">
                        <p>将<em>B站视频</em>内容转换为通俗易懂的语言。</p>
                    </div>
                    <div id="plain-content" class="ai-summary-content"></div>
                `;
            } else {
                tabContentElement.innerHTML = `
                    <div class="ai-summary-action-area">
                        <button id="generate-plain-btn" class="ai-summary-action-button">
                            <span class="icon">🗣️</span> 网页内容大白话
                        </button>
                    </div>
                    <div class="info-message">
                        <p>将网页内容转换为通俗易懂的语言，让复杂内容更容易理解。</p>
                    </div>
                    <div id="plain-content" class="ai-summary-content"></div>
                `;
            }
            
            // 监听大白话按钮
            document.getElementById('generate-plain-btn').addEventListener('click', () => {
                console.log("大白话按钮被点击");
                handleQuickAction('getPlainSummary', isPlainBilibiliVideo);
            });
            break;
            
        case 'chat':
            tabContentElement.innerHTML = `
                <div class="ai-summary-chat-container">
                    <div class="ai-chat-header">
                        <button id="copy-chat-history" class="ai-chat-history-btn" title="复制全部对话">
                    <div class="ai-summary-chat-history" id="ai-chat-history"></div>
                    <div class="ai-summary-chat-input">
                        <div class="ai-chat-input-area">
                            <textarea id="ai-chat-input" placeholder="有什么想问的..." rows="1"></textarea>
                            <button id="ai-chat-send" title="发送">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="22" y1="2" x2="11" y2="13"></line>
                                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            // 缓存聊天相关元素
            chatHistoryElement = document.getElementById('ai-chat-history');
            chatInputElement = document.getElementById('ai-chat-input');
            chatSendButtonElement = document.getElementById('ai-chat-send');
            
            // 添加聊天历史
            loadChatMessages();
            
            // 设置聊天输入和发送事件
            setupChatEvents();
            
            break;
    }
} 

// 添加滚动监听函数
function setupScrollListeners() {
    // 为聊天区域添加滚动监听
    if (chatHistoryElement) {
        chatHistoryElement.addEventListener('scroll', handleUserScroll);
    }
    
    // 为内容区域添加滚动监听
    if (tabContentElement) {
        tabContentElement.addEventListener('scroll', handleUserScroll);
    }
    
    // 为了确保监听器随内容变化添加，在标签切换时也重新设置
    const contentElements = document.querySelectorAll('.content');
    contentElements.forEach(el => {
        el.addEventListener('scroll', handleUserScroll);
    });
}

// 处理用户滚动事件
function handleUserScroll(event) {
    const element = event.target;
    const isNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 50;
    
    if (!isNearBottom) {
        // 用户滚动到了上方，记录状态并显示"回到底部"按钮
        userHasScrolled = true;
        showScrollToBottomButton();
    } else {
        // 用户已经在底部，可以恢复自动滚动
        userHasScrolled = false;
        hideScrollToBottomButton();
    }
}

// 显示"回到底部"按钮
function showScrollToBottomButton() {
    // 检查按钮是否已存在
    if (!document.getElementById('scroll-to-bottom-btn')) {
        const scrollBtn = document.createElement('button');
        scrollBtn.id = 'scroll-to-bottom-btn';
        scrollBtn.className = 'scroll-to-bottom-button';
        scrollBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
        `;
        
        // 将按钮添加到文档的根元素，确保它在对话框外
        document.documentElement.appendChild(scrollBtn);
        
        // 添加按钮事件
        scrollBtn.addEventListener('click', () => {
            userHasScrolled = false;
            autoScroll = true;
            scrollToChatBottom();
            hideScrollToBottomButton();
        });
    }
    
    // 显示按钮
    const scrollBtn = document.getElementById('scroll-to-bottom-btn');
    if (scrollBtn) {
        scrollBtn.style.display = 'flex';
        setTimeout(() => {
            scrollBtn.classList.add('visible');
        }, 10);
    }
}

// 隐藏"回到底部"按钮
function hideScrollToBottomButton() {
    const scrollBtn = document.getElementById('scroll-to-bottom-btn');
    if (scrollBtn) {
        scrollBtn.classList.remove('visible');
        setTimeout(() => {
            scrollBtn.style.display = 'none';
        }, 300);
    }
}