console.log('background.js 已加载');

// 存储当前视频标签页的信息
let currentVideoTabs = {};

// 防止无限循环的标志
let isProcessing = false;
let lastProcessedUrl = '';

// 更新当前视频标签页的信息
function updateCurrentVideoTab(tabId, url) {
  if (isVideoUrl(url)) {
    currentVideoTabs[tabId] = url;
    console.log('更新视频标签页:', tabId, url);
  }
}

// 检查URL是否是视频页面
function isVideoUrl(url) {
  return url.includes('youtube.com/watch') || 
         url.includes('bilibili.com/video') || 
         url.includes('vimeo.com');
}

// 从URL中提取时间戳
function extractTimestamp(url) {
  const parsedUrl = new URL(url);
  if (parsedUrl.hostname.includes('youtube.com')) {
    return parsedUrl.searchParams.get('t');
  } else if (parsedUrl.hostname.includes('bilibili.com')) {
    return parsedUrl.searchParams.get('t');
  } else if (parsedUrl.hostname.includes('vimeo.com')) {
    return parsedUrl.hash.replace('#t=', '');
  }
  return null;
}

// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    updateCurrentVideoTab(tabId, tab.url);
  }
});

// 监听新标签页创建
chrome.tabs.onCreated.addListener((tab) => {
  if (!isProcessing) {
    handleNewTab(tab);
  }
});

// 监听导航事件
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId === 0 && !isProcessing) { // 只处理主框架的导航
    handleNavigation(details);
  }
});

function handleNewTab(tab) {
  console.log('新标签页创建:', tab.pendingUrl || tab.url);
  
  const url = tab.pendingUrl || tab.url;
  if (isVideoUrl(url)) {
    const timestamp = extractTimestamp(url);
    if (timestamp) {
      redirectToExistingTab(url, timestamp, tab.id);
    }
  }
}

function handleNavigation(details) {
  console.log('导航事件:', details.url);
  
  if (isVideoUrl(details.url)) {
    const timestamp = extractTimestamp(details.url);
    if (timestamp) {
      redirectToExistingTab(details.url, timestamp, details.tabId);
    }
  }
}

function redirectToExistingTab(url, timestamp, sourceTabId) {
  if (isProcessing || url === lastProcessedUrl) return;
  isProcessing = true;
  lastProcessedUrl = url;

  // 检查是否有匹配的视频标签页
  let matchingTabId = null;
  for (let [existingTabId, existingUrl] of Object.entries(currentVideoTabs)) {
    if (isSimilarVideoUrl(existingUrl, url)) {
      matchingTabId = parseInt(existingTabId);
      break;
    }
  }

  if (matchingTabId !== null && matchingTabId !== sourceTabId) {
    console.log('找到匹配的视频标签页:', matchingTabId);
    // 更新现有标签页
    chrome.tabs.update(matchingTabId, {active: true}, () => {
      // 在标签页更新后发送消息以跳转到时间戳
      setTimeout(() => {
        chrome.tabs.sendMessage(matchingTabId, {
          action: "seekToTimestamp",
          timestamp: timestamp,
          url: url
        });
        // 关闭源标签页
        chrome.tabs.remove(sourceTabId);
        isProcessing = false;
      }, 500);
    });
  } else {
    // 如果是当前标签页或没有找到匹配的标签页，直接在当前标签页中处理
    chrome.tabs.sendMessage(sourceTabId, {
      action: "seekToTimestamp",
      timestamp: timestamp,
      url: url
    }, (response) => {
      if (chrome.runtime.lastError) {
        // 如果发送消息失败，可能是因为content script还没有加载，尝试更新标签页
        chrome.tabs.update(sourceTabId, {url: url}, () => {
          setTimeout(() => {
            chrome.tabs.sendMessage(sourceTabId, {
              action: "seekToTimestamp",
              timestamp: timestamp,
              url: url
            });
            isProcessing = false;
          }, 500);
        });
      } else {
        isProcessing = false;
      }
    });
  }
}

// 检查两个视频URL是否相似
function isSimilarVideoUrl(url1, url2) {
  const parsedUrl1 = new URL(url1);
  const parsedUrl2 = new URL(url2);
  
  if (parsedUrl1.hostname.includes('youtube.com') && parsedUrl2.hostname.includes('youtube.com')) {
    return parsedUrl1.searchParams.get('v') === parsedUrl2.searchParams.get('v');
  } else if (parsedUrl1.hostname.includes('bilibili.com') && parsedUrl2.hostname.includes('bilibili.com')) {
    return parsedUrl1.pathname === parsedUrl2.pathname;
  } else if (parsedUrl1.hostname.includes('vimeo.com') && parsedUrl2.hostname.includes('vimeo.com')) {
    return parsedUrl1.pathname === parsedUrl2.pathname;
  }
  return false;
}

// 保留原有的其他功能代码...

chrome.commands.onCommand.addListener((command) => {
  console.log('收到命令:', command);
  if (command === 'get_timestamp' || command === 'get_screenshot') {
    executeContentScript(command === 'get_timestamp' ? "getTimestamp" : "getScreenshot");
  }
});

function executeContentScript(action) {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (tabs[0]) {
      console.log('执行内容脚本，动作:', action);
      chrome.tabs.sendMessage(tabs[0].id, {action: action}, (response) => {
        if (chrome.runtime.lastError) {
          console.error('执行脚本时出错:', chrome.runtime.lastError);
        } else if (response) {
          handleResult(response, tabs[0].id);
        }
      });
    } else {
      console.error('未找到活动标签页');
    }
  });
}

function handleResult(result, tabId) {
  console.log('处理结果:', result);
  if (result.type === "timestamp") {
    chrome.tabs.sendMessage(tabId, {action: "copyToClipboard", text: result.link}, (response) => {
      if (chrome.runtime.lastError) {
        console.error('发送消息时出错:', chrome.runtime.lastError);
      } else if (response && response.success) {
        console.log('时间戳链接已复制到剪贴板');
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon.png',
          title: '时间戳链接已复制',
          message: '时间戳链接已成功复制到剪贴板'
        });
      } else {
        console.error('复制到剪贴板失败');
      }
    });
  } else if (result.type === "screenshot") {
    // ... 处理截图的代码 ...
  } else if (result.type === "error") {
    console.error('错误:', result.message);
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: '操作失败',
      message: result.message
    });
  }
}