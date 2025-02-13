// Remove the click listener since we're using popup now
chrome.runtime.onMessage.addListener((request, sender, callback) => {
  if (request.action === 'generateNotes') {
    console.log('Background: Received generateNotes request');
    
    // Get the tab ID from the request
    const tabId = request.tabId;
    
    // First inject config.js
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['config.js']
    }).then(() => {
      console.log('Background: Config script injected');
      // Then inject content.js
      return chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
    }).then(() => {
      console.log('Background: Content script injected');
      // After scripts are injected, send the format and dev mode
      return chrome.tabs.sendMessage(tabId, {
        action: 'generateNotes',
        format: request.format,
        devMode: request.devMode
      });
    }).catch(error => {
      console.error('Background: Script injection failed:', error);
    });
  }
  return true; // Keep the message channel open for async response
});

// Log when background script loads
console.log('Background script loaded');

// Remove the extractTranscript function as it's now handled in content.js 