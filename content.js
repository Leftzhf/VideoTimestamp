function getVideoElement() {
  // 首先尝试获取Bilibili的播放器
  const bilibiliPlayer = document.querySelector('.bilibili-player-video video');
  if (bilibiliPlayer) {
    console.log('找到Bilibili播放器');
    return bilibiliPlayer;
  }
  
  // 如果不是Bilibili,则尝试获取普通的video元素
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
    return null;
  }
  
  const timestamp = getTimestamp();
  const currentUrl = new URL(window.location.href);
  const currentTime = Math.floor(video.currentTime);
  
  // 针对不同网站的特殊处理
  if (currentUrl.hostname.includes('youtube.com')) {
    currentUrl.searchParams.set('t', currentTime + 's');
  } else if (currentUrl.hostname.includes('bilibili.com')) {
    currentUrl.searchParams.set('t', currentTime);
  } else if (currentUrl.hostname.includes('vimeo.com')) {
    currentUrl.hash = '#t=' + currentTime + 's';
  } else {
    // 其他网站的通用处理
    currentUrl.searchParams.set('t', currentTime);
  }
  
  console.log('生成的时间戳链接:', `[${timestamp}](${currentUrl.toString()})`);
  return `[${timestamp}](${currentUrl.toString()})`;
}

function captureScreenshot() {
  const video = getVideoElement();
  if (!video) {
    console.log('截图失败: 未找到视频元素');
    return null;
  }
  
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  console.log('截图成功');
  return canvas.toDataURL('image/png');
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('收到消息:', request.action);
  if (request.action === "getTimestamp") {
    const link = generateTimestampLink();
    if (link) {
      console.log('生成的时间戳链接:', link);
      chrome.runtime.sendMessage({type: "timestamp", link: link});
    } else {
      chrome.runtime.sendMessage({type: "error", message: "未找到视频元素"});
    }
  } else if (request.action === "getScreenshot") {
    const dataUrl = captureScreenshot();
    if (dataUrl) {
      chrome.runtime.sendMessage({type: "screenshot", dataUrl: dataUrl});
    } else {
      chrome.runtime.sendMessage({type: "error", message: "截图失败"});
    }
  }
});

console.log('content.js 已加载');