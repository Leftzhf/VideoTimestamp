function setShortcut(element) {
  let keys = [];
  
  element.addEventListener('keydown', (e) => {
    e.preventDefault();
    keys = [];
    
    if (e.ctrlKey) keys.push('Ctrl');
    if (e.altKey) keys.push('Alt');
    if (e.shiftKey) keys.push('Shift');
    
    if (e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Shift') {
      keys.push(e.key.toUpperCase());
    }
    
    element.textContent = keys.join('+');
  });
  
  element.addEventListener('keyup', (e) => {
    if (keys.length > 0) {
      element.blur();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const timestampShortcut = document.getElementById('timestampShortcut');
  const screenshotShortcut = document.getElementById('screenshotShortcut');
  
  setShortcut(timestampShortcut);
  setShortcut(screenshotShortcut);
  
  document.getElementById('save').addEventListener('click', () => {
    chrome.storage.sync.set({
      timestampShortcut: timestampShortcut.textContent,
      screenshotShortcut: screenshotShortcut.textContent
    }, () => {
      alert('设置已保存');
    });
  });
  
  // 加载保存的设置
  chrome.storage.sync.get(['timestampShortcut', 'screenshotShortcut'], (result) => {
    timestampShortcut.textContent = result.timestampShortcut || '点击此处设置快捷键';
    screenshotShortcut.textContent = result.screenshotShortcut || '点击此处设置快捷键';
  });
});