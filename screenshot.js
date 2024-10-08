chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "displayScreenshot") {
    document.getElementById('screenshot').src = request.dataUrl;
  }
});