document.addEventListener('DOMContentLoaded', function() {
  console.log('Popup: DOM loaded');
  
  const button = document.getElementById('generate');
  const status = document.getElementById('status');
  const devMode = document.getElementById('devMode');

  // Check if we're on a valid page
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (!tabs[0]?.url?.includes('echo360.org.uk/lesson')) {
      status.textContent = 'Please open an Echo360 lecture page';
      button.disabled = true;
      return;
    }
  });

  // Load saved dev mode state
  chrome.storage.local.get(['devMode'], function(result) {
    console.log('Popup: Loading dev mode state:', result.devMode);
    devMode.checked = result.devMode || false;
  });

  // Save dev mode state when changed
  devMode.addEventListener('change', function() {
    chrome.storage.local.set({ devMode: devMode.checked });
    console.log('Popup: Dev mode changed:', devMode.checked);
  });

  button.addEventListener('click', function() {
    console.log('Popup: Generate button clicked');
    button.disabled = true;
    const selectedFormat = document.querySelector('input[name="format"]:checked').value;
    console.log('Popup: Selected format:', selectedFormat);
    status.textContent = 'Generating notes...';

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs[0]) {
        console.error('Popup: No active tab found');
        status.textContent = 'Error: No active tab found';
        button.disabled = false;
        return;
      }

      console.log('Popup: Active tab URL:', tabs[0].url);
      
      // Send message to background script
      chrome.runtime.sendMessage({
        action: 'generateNotes',
        format: selectedFormat,
        devMode: devMode.checked,
        tabId: tabs[0].id
      }, response => {
        console.log('Popup: Received response:', response);
      });

      status.textContent = devMode.checked ? 'Dev mode: Skipping OpenAI' : 'Processing...';
      
      // Enable the button after a delay
      setTimeout(() => {
        button.disabled = false;
        status.textContent = '';
      }, 2000);
    });
  });
}); 