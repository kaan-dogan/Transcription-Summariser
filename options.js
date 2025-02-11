document.addEventListener('DOMContentLoaded', function() {
  // Load saved API key if it exists
  chrome.storage.local.get(['OPENAI_API_KEY'], function(result) {
    if (result.OPENAI_API_KEY) {
      document.getElementById('apiKey').value = result.OPENAI_API_KEY;
    }
  });

  // Save API key when form is submitted
  document.getElementById('saveKey').addEventListener('click', function() {
    const apiKey = document.getElementById('apiKey').value;
    chrome.storage.local.set({
      OPENAI_API_KEY: apiKey
    }, function() {
      document.getElementById('status').textContent = 'API key saved!';
      setTimeout(() => {
        document.getElementById('status').textContent = '';
      }, 2000);
    });
  });
}); 