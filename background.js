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
         url.includes('vimeo.com') ||
         (url.includes('pan.baidu.com/pfile/video') && url.includes('path='));
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
  } else if (parsedUrl.hostname.includes('pan.baidu.com')) {
    return parsedUrl.searchParams.get('t');
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
  if (isProcessing) return;
  isProcessing = true;

  chrome.tabs.query({}, (tabs) => {
    let matchingTabId = null;
    for (let tab of tabs) {
      if (isSimilarVideoUrl(tab.url, url)) {
        matchingTabId = tab.id;
        break;
      }
    }

    if (matchingTabId !== null) {
      console.log('找到匹配的视频标签页:', matchingTabId);
      // 更新现有标签页
      chrome.tabs.update(matchingTabId, {active: true}, () => {
        sendSeekMessage(matchingTabId, timestamp, url, sourceTabId);
      });
    } else {
      // 如果没有找到匹配的标签页，在当前标签页中处理
      sendSeekMessage(sourceTabId, timestamp, url);
    }
  });
}

function sendSeekMessage(tabId, timestamp, url, sourceTabId = null) {
  chrome.tabs.sendMessage(tabId, {
    action: "seekToTimestamp",
    timestamp: timestamp,
    url: url
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('发送消息时出错:', chrome.runtime.lastError);
      // 如果发送消息失败，可能是因为content script还没有加载，尝试更新标签页
      chrome.tabs.update(tabId, {url: url}, () => {
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, {
            action: "seekToTimestamp",
            timestamp: timestamp,
            url: url
          });
          isProcessing = false;
        }, 1000);
      });
    } else if (response && response.success) {
      console.log('成功跳转到时间戳');
      if (sourceTabId && sourceTabId !== tabId) {
        chrome.tabs.remove(sourceTabId);
      }
      isProcessing = false;
    } else {
      console.error('跳转到时间戳失败');
      isProcessing = false;
    }
  });
}

function isSimilarVideoUrl(url1, url2) {
  const parsedUrl1 = new URL(url1);
  const parsedUrl2 = new URL(url2);
  
  if (parsedUrl1.hostname.includes('pan.baidu.com') && parsedUrl2.hostname.includes('pan.baidu.com')) {
    // 对于百度网盘，我们只比较 path 参数
    return parsedUrl1.searchParams.get('path') === parsedUrl2.searchParams.get('path');
  } else if (parsedUrl1.hostname.includes('bilibili.com') && parsedUrl2.hostname.includes('bilibili.com')) {
    // 对于B站，我们比较视频ID
    const biliRegex = /\/video\/([^/?]+)/;
    const match1 = parsedUrl1.pathname.match(biliRegex);
    const match2 = parsedUrl2.pathname.match(biliRegex);
    return match1 && match2 && match1[1] === match2[1];
  } else if (parsedUrl1.hostname.includes('youtube.com') && parsedUrl2.hostname.includes('youtube.com')) {
    return parsedUrl1.searchParams.get('v') === parsedUrl2.searchParams.get('v');
  } else if (parsedUrl1.hostname.includes('vimeo.com') && parsedUrl2.hostname.includes('vimeo.com')) {
    return parsedUrl1.pathname === parsedUrl2.pathname;
  }
  return false;
}

// 保留原有的其他功能代码...

// 在文件开头添加这个函数
function showNotification(message) {
  console.log('尝试显示通知:', message);
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon.png',
    title: '视频时间戳捕获',
    message: message
  }, (notificationId) => {
    if (chrome.runtime.lastError) {
      console.error('显示通知失败:', chrome.runtime.lastError);
    } else {
      console.log('通知已显示, ID:', notificationId);
    }
  });
}

// 修改 chrome.commands.onCommand 监听器
chrome.commands.onCommand.addListener((command) => {
  console.log('收到命令:', command);
  if (command === 'get_timestamp' || command === 'get_screenshot') {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0]) {
        console.log('向内容脚本发送消息:', command);
        chrome.tabs.sendMessage(tabs[0].id, {
          action: command === 'get_timestamp' ? "getTimestamp" : "getScreenshot"
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('发送消息时出错:', chrome.runtime.lastError);
            showNotification('操作失败: ' + chrome.runtime.lastError.message);
          } else if (response) {
            console.log('收到内容脚本响应:', response);
            handleResult(response, tabs[0].id);
          }
        });
      } else {
        console.error('未找到活动标签页');
        showNotification('未找到活动标签页');
      }
    });
  }
});

// 修改 handleResult 函数
function handleResult(result, tabId) {
  console.log('处理结果:', result);
  if (result.type === "timestamp") {
    chrome.tabs.sendMessage(tabId, {action: "copyToClipboard", text: result.link});
  } else if (result.type === "screenshot") {
    chrome.tabs.sendMessage(tabId, {action: "copyScreenshot", dataUrl: result.dataUrl});
  } else if (result.type === "error") {
    chrome.tabs.sendMessage(tabId, {action: "showNotification", message: '操作失败: ' + result.message});
  }
}

// 添加一个新的消息监听器
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'showNotification') {
    showNotification(request.message);
  }
});

// ... 保留其他现有代码 ...
// ... 保留其他现有代码 ...