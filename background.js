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
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      canvas.toBlob(blob => {
        navigator.clipboard.write([
          new ClipboardItem({'image/png': blob})
        ]).then(() => {
          console.log('截图已复制到剪贴板');
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon.png',
            title: '截图已复制',
            message: '视频截图已成功复制到剪贴板'
          });
        }).catch(err => {
          console.error('复制截图到剪贴板失败:', err);
        });
      }, 'image/png');
    };
    img.src = result.dataUrl;
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