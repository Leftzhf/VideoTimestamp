console.log('popup.js 已加载');

function executeContentScript(action) {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (tabs[0]) {
      console.log('执行内容脚本，动作:', action);
      chrome.tabs.sendMessage(tabs[0].id, {action: action}, (response) => {
        if (chrome.runtime.lastError) {
          console.error('执行脚本时出错:', chrome.runtime.lastError);
          document.getElementById('result').innerHTML = `
            <p style="color: red;">错误: 无法执行内容脚本</p>
          `;
        } else if (response) {
          handleResult(response, tabs[0].id);
        }
      });
    }
  });
}

function handleResult(result, tabId) {
  console.log('处理结果:', result);
  if (result.type === "timestamp") {
    chrome.tabs.sendMessage(tabId, {action: "copyToClipboard", text: result.link}, (response) => {
      if (response && response.success) {
        document.getElementById('result').innerHTML = `
          <p style="color: green;">时间戳链接已成功复制到剪贴板</p>
          <pre>${result.link}</pre>
        `;
      } else {
        document.getElementById('result').innerHTML = `
          <p style="color: red;">错误: 复制到剪贴板失败</p>
        `;
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
          document.getElementById('result').innerHTML = `
            <p style="color: green;">截图已成功复制到剪贴板</p>
          `;
        }).catch(err => {
          console.error('复制图片到剪贴板失败:', err);
          document.getElementById('result').innerHTML = `
            <p style="color: red;">错误: 复制截图到剪贴板失败</p>
          `;
        });
      }, 'image/png');
    };
    img.src = result.dataUrl;
  } else if (result.type === "error") {
    document.getElementById('result').innerHTML = `
      <p style="color: red;">错误: ${result.message}</p>
    `;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM 已加载');
  document.getElementById('getTimestamp').addEventListener('click', () => {
    console.log('获取时间戳按钮被点击');
    executeContentScript("getTimestamp");
  });

  document.getElementById('getScreenshot').addEventListener('click', () => {
    console.log('获取截图按钮被点击');
    executeContentScript("getScreenshot");
  });
});