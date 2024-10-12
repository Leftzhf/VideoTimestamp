console.log('content.js 已加载');

let isProcessingSeek = false;
let lastSeekTimestamp = 0;

// 视频平台处理器
const platformHandlers = {
  bilibili: {
    getVideoElement: () => {
      const video = document.querySelector('.bilibili-player-video video') || 
                    document.querySelector('#bilibili-player video') ||
                    document.querySelector('#bofqi video');
      if (video) console.log('找到Bilibili播放器');
      return video;
    },
    generateTimestampLink: (video, timestamp, currentUrl) => {
      currentUrl.searchParams.set('t', Math.floor(video.currentTime));
      return `[${timestamp}](${currentUrl.toString()})`;
    },
    seekToTimestamp: (video, targetTime) => {
      video.currentTime = targetTime;
      // 阻止默认的页面跳转
      history.pushState(null, '', window.location.href);
    }
  },
  baiduPan: {
    getVideoElement: () => {
      const video = document.querySelector('#video-wrap video') || 
                    document.querySelector('.vjs-tech');
      if (video) console.log('找到百度网盘播放器');
      return video;
    },
    generateTimestampLink: (video, timestamp, currentUrl) => {
      currentUrl.searchParams.set('t', Math.floor(video.currentTime));
      const specialParam = currentUrl.searchParams.get('_t');
      if (specialParam) {
        currentUrl.searchParams.set('_t', specialParam);
      }
      return `[${timestamp}](${currentUrl.toString()})`;
    },
    seekToTimestamp: (video, targetTime) => {
      video.currentTime = targetTime;
      let attempts = 0;
      const maxAttempts = 10;
      const checkAndAdjust = () => {
        if (Math.abs(video.currentTime - targetTime) > 1 && attempts < maxAttempts) {
          video.currentTime = targetTime;
          attempts++;
          setTimeout(checkAndAdjust, 200);
        } else if (attempts >= maxAttempts) {
          console.error('无法精确跳转到指定时间戳');
        }
      };
      checkAndAdjust();
      // 阻止默认的页面跳转
      history.pushState(null, '', window.location.href);
    }
  },
  // 可以添加其他平台的处理器
};

function getPlatformHandler() {
  const hostname = window.location.hostname;
  if (hostname.includes('bilibili.com')) return platformHandlers.bilibili;
  if (hostname.includes('pan.baidu.com')) return platformHandlers.baiduPan;
  // 可以添加其他平台的判断
  return null;
}

function getVideoElement() {
  const handler = getPlatformHandler();
  if (handler) {
    const video = handler.getVideoElement();
    if (video) return video;
  }
  // 如果特定平台的处理器没有找到视频元素，尝试通用方法
  const video = document.querySelector('video');
  if (video) console.log('找到普通视频元素');
  return video;
}

function getTimestamp() {
  const video = getVideoElement();
  if (!video) {
    console.log('获取时间戳失败: 未找到视频元素');
    return null;
  }
  
  const currentTime = video.currentTime;
  const hours = Math.floor(currentTime / 3600);
  const minutes = Math.floor((currentTime % 3600) / 60);
  const seconds = Math.floor(currentTime % 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function generateTimestampLink() {
  const video = getVideoElement();
  if (!video) {
    console.log('生成时间戳链接失败: 未找到视频元素');
    return {type: "error", message: "未找到视频元素"};
  }
  
  const timestamp = getTimestamp();
  const currentUrl = new URL(window.location.href);
  
  const handler = getPlatformHandler();
  if (handler) {
    const link = handler.generateTimestampLink(video, timestamp, currentUrl);
    console.log('生成的时间戳链接:', link);
    return {type: "timestamp", link: link};
  }
  
  // 默认处理
  currentUrl.searchParams.set('t', Math.floor(video.currentTime));
  const link = `[${timestamp}](${currentUrl.toString()})`;
  console.log('生成的时间戳链接:', link);
  return {type: "timestamp", link: link};
}

function captureScreenshot() {
  const video = getVideoElement();
  if (!video) {
    console.log('截图失败: 未找到视频元素');
    return {type: "error", message: "截图失败: 未找到视频元素"};
  }
  
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  console.log('截图成功');
  return {type: "screenshot", dataUrl: canvas.toDataURL('image/png')};
}

function copyToClipboard(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
}

function seekToTimestamp(timestamp) {
  if (isProcessingSeek) return false;
  isProcessingSeek = true;

  const video = getVideoElement();
  if (!video) {
    console.log('跳转失败: 未找到视频元素');
    isProcessingSeek = false;
    return false;
  }

  if (timestamp) {
    const targetTime = parseInt(timestamp);
    const handler = getPlatformHandler();
    if (handler) {
      handler.seekToTimestamp(video, targetTime);
    } else {
      video.currentTime = targetTime;
    }
    lastSeekTimestamp = targetTime;
    console.log('视频已跳转到时间戳:', timestamp);
    // 阻止默认的页面跳转
    history.pushState(null, '', window.location.href);
  }
  isProcessingSeek = false;
  return true;
}

function checkUrlAndSeek() {
  if (isProcessingSeek) return;

  const url = new URL(window.location.href);
  let timestamp;

  const handler = getPlatformHandler();
  if (handler) {
    timestamp = url.searchParams.get('t');
  } else if (url.hostname.includes('youtube.com')) {
    timestamp = url.searchParams.get('t');
    if (timestamp) {
      timestamp = parseInt(timestamp.replace('s', ''));
    }
  } else if (url.hostname.includes('vimeo.com')) {
    timestamp = url.hash.replace('#t=', '');
    if (timestamp) {
      timestamp = parseInt(timestamp.replace('s', ''));
    }
  } else {
    timestamp = url.searchParams.get('t');
  }

  if (timestamp && timestamp !== lastSeekTimestamp) {
    seekToTimestamp(timestamp);
  }
}

// 监听 URL 变化
let lastUrl = location.href; 
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(checkUrlAndSeek, 500); // 添加延迟以确保视频元素已加载
  }
}).observe(document, {subtree: true, childList: true});

// 页面加载时也检查一次
window.addEventListener('load', () => setTimeout(checkUrlAndSeek, 1000));

// 在文件开头添加这个函数
function showPageNotification(message) {
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: #4CAF50;
    color: white;
    padding: 16px;
    border-radius: 4px;
    z-index: 9999;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  `;
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.5s';
    setTimeout(() => document.body.removeChild(notification), 500);
  }, 3000);
}

// 修改 handleShortcut 函数
function handleShortcut(action) {
  if (action === "getTimestamp") {
    const result = generateTimestampLink();
    if (result.type === "timestamp") {
      const timestamp = result.link.match(/\[(.*?)\]/)[1]; // 从链接中提取时间戳
      showPageNotification(`(${timestamp}) 内容已复制到剪贴板`);
    } else {
      showPageNotification('获取时间戳失败');
    }
    return result;
  } else if (action === "getScreenshot") {
    const result = captureScreenshot();
    showPageNotification(result.type === "screenshot" ? '截图已成功捕获!' : '获取截图失败');
    return result;
  }
}

// 修改消息监听器
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('content.js 收到消息:', request.action);
  let result;
  if (request.action === "getTimestamp" || request.action === "getScreenshot") {
    result = handleShortcut(request.action);
    console.log('handleShortcut 结果:', result);
    sendResponse(result);
  } else if (request.action === "copyToClipboard") {
    copyToClipboard(request.text);
    const timestamp = request.text.match(/\[(.*?)\]/)[1]; // 从链接中提取时间戳
    showPageNotification(`(${timestamp}) 内容已复制到剪贴板`);
    sendResponse({success: true});
  } else if (request.action === "seekToTimestamp") {
    const success = seekToTimestamp(request.timestamp);
    if (success) {
      history.pushState(null, '', request.url);
      showPageNotification('已跳转到指定时间戳');
    }
    sendResponse({success: success});
  } else if (request.action === "copyScreenshot") {
    copyScreenshotToClipboard(request.dataUrl)
      .then(() => {
        showPageNotification('截图已复制到剪贴板');
        sendResponse({success: true});
      })
      .catch((error) => {
        console.error('复制截图到剪贴板失败:', error);
        showPageNotification('复制截图失败');
        sendResponse({success: false});
      });
    return true; // 保持消息通道开放以进行异步响应
  }
  return true; // 保持消息通道开放以进行异步响应
});

function copyScreenshotToClipboard(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      
      canvas.toBlob(blob => {
        const item = new ClipboardItem({ 'image/png': blob });
        navigator.clipboard.write([item]).then(() => {
          console.log('截图已成功复制到剪贴板');
          resolve();
        }).catch(error => {
          console.error('复制截图到剪贴板失败:', error);
          if (error.name === 'NotAllowedError' && error.message.includes('Document is not focused')) {
            // 当出现特定错误时，将图片转换为 base64 文本并复制
            const base64 = canvas.toDataURL('image/png');
            copyTextToClipboard(base64)
              .then(() => {
                console.log('截图已作为 base64 文本复制到剪贴板');
                resolve();
              })
              .catch(textError => {
                console.error('复制 base64 文本到剪贴板失败:', textError);
                reject(textError);
              });
          } else {
            reject(error);
          }
        });
      }, 'image/png');
    };
    img.onerror = (error) => {
      console.error('加载图片失败:', error);
      reject(error);
    };
    img.src = dataUrl;
  });
}

function copyTextToClipboard(text) {
  return new Promise((resolve, reject) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";  // Avoid scrolling to bottom
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        resolve();
      } else {
        reject(new Error('复制失败'));
      }
    } catch (err) {
      reject(err);
    }

    document.body.removeChild(textArea);
  });
}