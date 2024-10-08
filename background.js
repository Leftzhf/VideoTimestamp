chrome.commands.onCommand.addListener((command) => {
  if (command === "get_timestamp") {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {action: "getTimestamp"});
    });
  } else if (command === "get_screenshot") {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {action: "getScreenshot"});
    });
  }
});