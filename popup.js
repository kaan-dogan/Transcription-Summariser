document.addEventListener('DOMContentLoaded', function() {
  const button = document.getElementById('generate');
  const status = document.getElementById('status');

  button.addEventListener('click', function() {
    button.disabled = true;
    const selectedFormat = document.querySelector('input[name="format"]:checked').value;
    status.textContent = 'Generating notes...';

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ['config.js', 'content.js']
      }).then(() => {
        // Send format preference to content script
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'generateNotes',
          format: selectedFormat
        });
        status.textContent = 'Processing...';
        setTimeout(() => {
          window.close();
        }, 1000);
      }).catch(err => {
        status.textContent = 'Error: ' + err.message;
        button.disabled = false;
      });
    });
  });
}); 