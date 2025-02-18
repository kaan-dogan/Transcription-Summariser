// This file handles the content script functionality
(function() {
  console.log('Content script starting execution');
  console.log('Config available:', window.config);
  console.log('API Key available:', window.config?.OPENAI_API_KEY);

  // Helper functions first
  function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type: type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function getTimestamp() {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
  }
  
  async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function processTranscript() {
    try {
      console.log('Starting transcript processing...');
      console.log('Current page URL:', window.location.href);
      
      // Wait for page to be fully loaded
      if (document.readyState !== 'complete') {
        console.log('Waiting for page to load...');
        await new Promise(resolve => window.addEventListener('load', resolve));
      }

      // Find transcript button
      const transcriptButton = document.querySelector('a.transcript, button.transcript');
      console.log('Transcript button found:', !!transcriptButton);
      
      if (!transcriptButton) {
        throw new Error('Transcript button not found - Are you on an Echo360 lecture page?');
      }

      // Check if panel is already visible
      const transcriptPanel = document.querySelector('.transcript-panel');
      if (!transcriptPanel || window.getComputedStyle(transcriptPanel).display === 'none') {
        console.log('Opening transcript panel...');
        transcriptButton.click();
        await delay(1500); // Wait for panel to open
      }

      // Get transcript lines
      const transcriptLines = document.querySelectorAll('.transcript-cues p span, .transcript-text');
      if (!transcriptLines || transcriptLines.length === 0) {
        throw new Error('No transcript found - Try refreshing the page');
      }

      // Collect all text
      const fullText = Array.from(transcriptLines)
        .map(line => line.textContent.trim())
        .filter(text => text.length > 0)
        .join(' ');

      if (fullText) {
        console.log('✅ TEST PASSED: Transcript extracted successfully');
        await getSummaryWithRetry(fullText, 1, 5000);
      } else {
        console.error('❌ TEST FAILED: No transcript text found in panel');
      }
    } catch (error) {
      console.error('Error processing transcript:', error);
      alert(error.message || 'Failed to process transcript. See console for details.');
    }
  }

  async function getSummaryWithRetry(text, attempt = 1, baseDelay = 5000) {
    const maxAttempts = 5;
    const delayMs = baseDelay * attempt;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': window.config?.OPENAI_API_KEY || 'Missing API Key'
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "gpt-4o-mini-2024-07-18",
          messages: [
            {
              role: "system",
              content: `You are a thorough and meticulous student taking detailed lecture notes...`
            },
            {
              role: "user",
              content: `Create extremely detailed lecture notes from this transcript:\n\n${text}`
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      // Generate PDF
      await generatePDF(content);
      
      console.log('✅ TEST PASSED: Notes generated successfully');
      
    } catch (error) {
      console.error('❌ ERROR:', error.message);
      if (attempt < maxAttempts) {
        return await getSummaryWithRetry(text, attempt + 1, baseDelay * 1.5);
      }
      throw error;
    }
  }

  // Add message listener
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'generateNotes') {
      processTranscript();
    }
  });

  console.log('✅ TEST PASSED: Content script loaded');
})();
