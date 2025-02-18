// Remove the click listener since we're using popup now
chrome.runtime.onMessage.addListener((request, sender, callback) => {
  if (request.action === 'generateNotes') {
    console.log('Background: Received generateNotes request');
    
    const tabId = request.tabId;
    
    // Check URL matches manifest permissions
    chrome.tabs.get(tabId, (tab) => {
      console.log('Current tab URL:', tab.url);
      
      if (!tab.url || !tab.url.includes('echo360.org.uk/lesson')) {
        console.error('Not on an Echo360 lecture page');
        alert('Please navigate to an Echo360 lecture page first.\nThe URL should start with "echo360.org.uk/lesson"');
        return;
      }
      
      // Inject scripts in sequence
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['libs/jspdf.min.js']
      })
      .then(() => {
        console.log('jsPDF loaded');
        return chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['pdf-generator.js']
        });
      })
      .then(() => {
        console.log('PDF generator loaded');
        return chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['config.js']
        });
      })
      .then(() => {
        console.log('Config loaded');
        return chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        });
      })
      .then(() => {
        console.log('All scripts loaded');
        return chrome.tabs.sendMessage(tabId, {
          action: 'generateNotes',
          format: request.format,
          devMode: request.devMode
        });
      })
      .catch(error => {
        console.error('Script injection failed:', error);
        alert('Failed to initialize extension. See console for details.');
      });
    });
  } else if (request.action === 'openLoginPage') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('login.html'),
      active: true
    });
    return;
  }
  return true; // Keep the message channel open for async response
});

// Log when background script loads
console.log('Background script loaded');

// Remove the extractTranscript function as it's now handled in content.js 