chrome.action.onClicked.addListener((tab) => {
  // First inject config.js
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['config.js']
  }).then(() => {
    // Then inject content.js after config is loaded
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
  });
});

function extractTranscript() {
  // Click the transcript button
  const transcriptButton = document.querySelector('a.transcript.classroomLink');
  if (transcriptButton) {
    transcriptButton.click();
    
    // Wait for the transcript panel to load
    setTimeout(() => {
      const transcriptLines = document.querySelectorAll('[id*="r59baf1cf-9689-437a-903c-5cd64dd66aef"] div.transcriptLine');
      let extractedText = '';
      
      transcriptLines.forEach(line => {
        extractedText += line.textContent.trim() + '\n';
      });

      // Create a download with the extracted text
      const blob = new Blob([extractedText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'transcript.txt';
      a.click();
      URL.revokeObjectURL(url);
    }, 2000); // Wait 2 seconds for the panel to load
  } else {
    console.error('Transcript button not found');
  }
} 