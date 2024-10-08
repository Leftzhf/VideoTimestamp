console.log('content.js 已加载');

let isProcessingSeek = false;
let lastSeekTimestamp = 0;

function getVideoElement() {
  const bilibiliPlayer = document.querySelector('.bilibili-player-video video');
  if (bilibiliPlayer) {
    console.log('找到Bilibili播放器');
    return bilibiliPlayer;
  }
  
  const generalVideo = document.querySelector('video');
  if (generalVideo) {
    console.log('找到普通视频元素');
    return generalVideo;
  }
  
  console.log('未找到视频元素');
  return null;
}

function getTimestamp() {
  const video = getVideoElement();
  if (!video) {
    console.log('获取时间戳失败: 未找到视频元素');
    return null;
  }
  
  const currentTime = video.currentTime;
  const minutes = Math.floor(currentTime / 60);
  const seconds = Math.floor(currentTime % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function generateTimestampLink() {
  const video = getVideoElement();
  if (!video) {
    console.log('生成时间戳链接失败: 未找到视频元素');
    return {type: "error", message: "未找到视频元素"};
  }
  
  const timestamp = getTimestamp();
  const currentUrl = new URL(window.location.href);
  const currentTime = Math.floor(video.currentTime);
  
  if (currentUrl.hostname.includes('youtube.com')) {
    currentUrl.searchParams.set('t', currentTime + 's');
  } else if (currentUrl.hostname.includes('bilibili.com')) {
    currentUrl.searchParams.set('t', currentTime);
  } else if (currentUrl.hostname.includes('vimeo.com')) {
    currentUrl.hash = '#t=' + currentTime + 's';
  } else {
    currentUrl.searchParams.set('t', currentTime);
  }
  
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
  if (isProcessingSeek) return;
  isProcessingSeek = true;

  const video = getVideoElement();
  if (!video) {
    console.log('跳转失败: 未找到视频元素');
    isProcessingSeek = false;
    return;
  }

  if (timestamp) {
    const targetTime = parseInt(timestamp);
    if (Math.abs(video.currentTime - targetTime) > 1 && targetTime !== lastSeekTimestamp) {
      video.currentTime = targetTime;
      lastSeekTimestamp = targetTime;
      console.log('视频已跳转到时间戳:', timestamp);
    }
  }
  isProcessingSeek = false;
}

function checkUrlAndSeek() {
  if (isProcessingSeek) return;

  const url = new URL(window.location.href);
  let timestamp;

  if (url.hostname.includes('youtube.com')) {
    timestamp = url.searchParams.get('t');
    if (timestamp) {
      timestamp = parseInt(timestamp.replace('s', ''));
    }
  } else if (url.hostname.includes('bilibili.com')) {
    timestamp = url.searchParams.get('t');
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('content.js 收到消息:', request.action);
  if (request.action === "getTimestamp") {
    sendResponse(generateTimestampLink());
  } else if (request.action === "getScreenshot") {
    sendResponse(captureScreenshot());
  } else if (request.action === "copyToClipboard") {
    copyToClipboard(request.text);
    sendResponse({success: true});
  } else if (request.action === "seekToTimestamp") {
    if (request.timestamp !== lastSeekTimestamp) {
      seekToTimestamp(request.timestamp);
      // 如果需要，更新URL
      if (window.location.href !== request.url) {
        window.history.pushState({}, '', request.url);
      }
    }
    sendResponse({success: true});
  }
});