document.addEventListener('DOMContentLoaded', function() {
  const button = document.getElementById('generate');
  const status = document.getElementById('status');
  const devMode = document.getElementById('devMode');

  console.log('Popup: Script loaded');

  // Load saved dev mode state
  chrome.storage.local.get(['devMode'], function(result) {
    devMode.checked = result.devMode || false;
    console.log('Popup: Dev mode loaded:', devMode.checked);
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
    status.textContent = 'Generating notes...';

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs[0]) {
        console.error('Popup: No active tab found');
        status.textContent = 'Error: No active tab found';
        button.disabled = false;
        return;
      }

      console.log('Popup: Sending message to background script');
      // Send message to background script
      chrome.runtime.sendMessage({
        action: 'generateNotes',
        format: selectedFormat,
        devMode: devMode.checked,
        tabId: tabs[0].id
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