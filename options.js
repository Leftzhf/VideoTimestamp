let shortcuts = {
  get_timestamp: '',
  get_screenshot: ''
};

function setShortcut(element, commandName) {
  let keys = [];
  
  element.addEventListener('keydown', (e) => {
    e.preventDefault();
    keys = [];
    
    if (e.metaKey || e.ctrlKey) keys.push(navigator.platform.indexOf('Mac') !== -1 ? 'Command' : 'Ctrl');
    if (e.altKey) keys.push('Alt');
    if (e.shiftKey) keys.push('Shift');
    
    if (e.key !== 'Meta' && e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Shift') {
      keys.push(e.key.toUpperCase());
    }
    
    element.textContent = keys.join('+');
    shortcuts[commandName] = keys.join('+');
  });
  
  element.addEventListener('keyup', (e) => {
    if (keys.length > 0) {
      element.blur();
    }
  });
}

function saveShortcuts() {
  chrome.storage.sync.set(shortcuts, () => {
    console.log('快捷键已保存:', shortcuts);
    const statusElement = document.getElementById('status');
    if (statusElement) {
      statusElement.textContent = '设置已保存。请在 chrome://extensions/shortcuts 页面手动设置快捷键。';
      setTimeout(() => {
        statusElement.textContent = '';
      }, 5000);
    }
  });
}

function loadShortcuts() {
  chrome.storage.sync.get(['get_timestamp', 'get_screenshot'], (result) => {
    Object.keys(result).forEach((key) => {
      const element = document.getElementById(key === 'get_timestamp' ? 'timestampShortcut' : 'screenshotShortcut');
      if (element) {
        element.textContent = result[key] || '点击此处设置快捷键';
        shortcuts[key] = result[key] || '';
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const timestampShortcut = document.getElementById('timestampShortcut');
  const screenshotShortcut = document.getElementById('screenshotShortcut');
  const saveButton = document.getElementById('save');
  
  setShortcut(timestampShortcut, 'get_timestamp');
  setShortcut(screenshotShortcut, 'get_screenshot');
  
  saveButton.addEventListener('click', saveShortcuts);
  
  loadShortcuts();
});