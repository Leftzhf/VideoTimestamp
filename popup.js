function executeContentScript(action) {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.scripting.executeScript({
      target: {tabId: tabs[0].id},
      function: contentScriptFunction,
      args: [action]
    }, (results) => {
      if (chrome.runtime.lastError) {
        console.error('执行脚本时出错:', chrome.runtime.lastError);
        document.getElementById('result').innerHTML = `
          <p style="color: red;">错误: 无法执行内容脚本</p>
        `;
      } else if (results && results[0]) {
        handleResult(results[0].result);
      }
    });
  });
}

function contentScriptFunction(action) {
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
      return {type: "error", message: "未找到视频元素"};
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

  if (action === "getTimestamp") {
    return generateTimestampLink();
  } else if (action === "getScreenshot") {
    return captureScreenshot();
  }
}

function handleResult(result) {
  if (result.type === "timestamp") {
    copyToClipboard(result.link);
    document.getElementById('result').innerHTML = `
      <p>时间戳链接已复制到剪贴板:</p>
      <pre>${result.link}</pre>
    `;
  } else if (result.type === "screenshot") {
    document.getElementById('result').innerHTML = `
      <p>截图已保存:</p>
      <img src="${result.dataUrl}" style="max-width: 100%;">
    `;
  } else if (result.type === "error") {
    document.getElementById('result').innerHTML = `
      <p style="color: red;">错误: ${result.message}</p>
    `;
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    console.log('文本已成功复制到剪贴板');
  }).catch(err => {
    console.error('复制到剪贴板失败:', err);
  });
}

document.getElementById('getTimestamp').addEventListener('click', () => {
  executeContentScript("getTimestamp");
});

document.getElementById('getScreenshot').addEventListener('click', () => {
  executeContentScript("getScreenshot");
});

console.log('popup.js 已加载');