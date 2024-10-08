console.log('background.js 已加载');

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
    chrome.tabs.sendMessage(tabId, {action: "copyImageToClipboard", dataUrl: result.dataUrl}, (response) => {
      if (chrome.runtime.lastError) {
        console.error('发送消息时出错:', chrome.runtime.lastError);
      } else if (response && response.success) {
        console.log('截图已复制到剪贴板');
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon.png',
          title: '截图已复制',
          message: '视频截图已成功复制到剪贴板'
        });
      } else {
        console.error('复制截图到剪贴板失败');
      }
    });
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "openScreenshot") {
    chrome.tabs.create({ url: 'screenshot.html' }, (tab) => {
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          chrome.tabs.sendMessage(tab.id, { action: "displayScreenshot", dataUrl: message.dataUrl });
        }
      });
    });
  }
});