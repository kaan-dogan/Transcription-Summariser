// This file can be empty for now, but we might need it later for more complex interactions 

(function() {
  console.log('Content script starting execution');
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
  
  // Message listener
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'generateNotes') {
      window.downloadFormat = request.format;
      window.devMode = request.devMode;
    }
  });

  // Main functionality
  const transcriptButton = document.querySelector('a.transcript');
  
  if (transcriptButton) {
    // Check if transcript panel is visible using XPath
    const transcriptPanel = document.evaluate(
      '/html/body/div[1]/div[2]/div/div/div/div[1]/div/div/div/div/div[4]/div[2]',
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;

    if (transcriptPanel && window.getComputedStyle(transcriptPanel).display !== 'none') {
      console.log('✅ TEST PASSED: Panel is visible, extracting transcript...');
      processTranscript();
    } else {
      console.log('Opening transcript panel...');
      transcriptButton.click();
      setTimeout(processTranscript, 1500);
    }
  } else {
    console.error('❌ TEST FAILED: Transcript button not found');
  }

  async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function formatSummary(content) {
    const lines = content.split('\n');
    let formatted = '';
    let inList = false;
    let inCode = false;

    lines.forEach(line => {
      // Remove markdown headers (##)
      line = line.replace(/^#+\s*/, '');
      
      // Convert markdown lists to proper bullet points
      line = line.replace(/^\s*-\s*/, '• ');
      line = line.replace(/^\s*\*\s*/, '• ');
      
      // Handle code blocks
      if (line.trim().startsWith('```')) {
        inCode = !inCode;
        if (inCode) {
          formatted += '\nCODE EXAMPLE:\n' + '='.repeat(12) + '\n';
        } else {
          formatted += '='.repeat(12) + '\n\n';
        }
        return;
      }

      if (inCode) {
        formatted += line + '\n';
        return;
      }
      
      // Add proper spacing between sections
      if (line.trim().length > 0) {
        if (line.match(/^[A-Z]/)) {  // If line starts with capital letter (likely a header)
          formatted += '\n' + line.toUpperCase() + '\n' + '='.repeat(line.length) + '\n\n';
        } else if (line.startsWith('• ')) {
          inList = true;
          formatted += line + '\n';
        } else {
          if (inList) {
            formatted += '\n';
            inList = false;
          }
          formatted += line + '\n';
        }
      }
    });

    return formatted;
  }

  async function getSummaryWithRetry(text, attempt = 1, baseDelay = 5000) {
    const maxAttempts = 5;
    const delayMs = baseDelay * attempt;

    try {
      if (window.devMode) {
        console.log('✅ TEST PASSED: Dev mode working');
        console.log('Dev mode: Skipping OpenAI request');
        // Use sample content for testing
        const sampleContent = `SAMPLE LECTURE NOTES
============================

INTRODUCTION
• This is a sample note for development
• Testing formatting and layout

CODE EXAMPLE:
function sampleCode() {
    console.log("Testing code blocks");
}
============

SUMMARY
• Testing bullet points
• Checking formatting`;

        // Handle different formats
        switch (window.downloadFormat) {
          case 'md':
            downloadFile(sampleContent, `lecture_notes_${getTimestamp()}.md`, 'text/markdown');
            break;
          case 'pdf':
            await generatePDF(sampleContent);
            break;
          default: // txt
            downloadFile(formatSummary(sampleContent), `lecture_notes_${getTimestamp()}.txt`, 'text/plain');
        }
        console.log('✅ TEST PASSED: Sample content generated');
        return;
      }

      if (attempt > 1) {
        console.log(`Retrying... (${attempt}/${maxAttempts})`);
        await delay(delayMs);
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': window.config.OPENAI_API_KEY
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo-16k",
          messages: [
            {
              role: "system",
              content: `You are a thorough and meticulous student taking detailed lecture notes. Create extremely comprehensive notes that:

1. IMPLEMENTATION & SYNTAX:
   - Document exact syntax and method signatures
   - Include complete code examples for each concept
   - Note any specific implementation requirements or constraints
   - Highlight constructor patterns and common methods

2. PRACTICAL DETAILS:
   - Record all advantages and disadvantages mentioned
   - Note performance characteristics and complexity
   - Document memory usage considerations
   - List common use cases and scenarios

3. EXAMPLES & APPLICATIONS:
   - Provide detailed code examples for each concept
   - Include real-world application scenarios
   - Show different variations of usage
   - Document edge cases and special situations

4. BEST PRACTICES & WARNINGS:
   - Note all tips and tricks mentioned
   - Document common pitfalls and how to avoid them
   - Include best practices for each concept
   - Highlight any warnings or cautions

5. COMPARISONS & ALTERNATIVES:
   - Compare with similar data structures or approaches
   - Note when to use one approach over another
   - Document trade-offs between different approaches

Format using clear sections with descriptive headers. Use code blocks for all examples. Include every technical detail mentioned by the lecturer. Make the notes as detailed as possible, assuming no prior knowledge.`
            },
            {
              role: "user",
              content: `Create extremely detailed lecture notes from this transcript. Include complete code examples, implementation details, and practical applications. Don't summarize - capture every technical detail mentioned:\n\n${text}`
            }
          ],
          max_tokens: 2000,  // Increased for more detail
          temperature: 0.2   // Reduced for more consistent output
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 429 && attempt < maxAttempts) {
          console.log('Rate limit hit, will retry...');
          return getSummaryWithRetry(text, attempt + 1, baseDelay * 1.5);
        }
        throw new Error(errorData.error?.message || 'API request failed');
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      // Handle different formats
      switch (window.downloadFormat) {
        case 'md':
          downloadFile(content, `lecture_notes_${getTimestamp()}.md`, 'text/markdown');
          break;
        case 'pdf':
          await generatePDF(content);
          break;
        default: // txt
          downloadFile(formatSummary(content), `lecture_notes_${getTimestamp()}.txt`, 'text/plain');
      }
      
      console.log('✅ TEST PASSED: Notes generated and downloaded successfully');
      
    } catch (error) {
      console.error('❌ TEST FAILED:', error.message);
      if (attempt < maxAttempts) {
        return getSummaryWithRetry(text, attempt + 1, baseDelay * 1.5);
      } else {
        console.error('Failed to generate notes after multiple attempts.');
      }
    }
  }

  // Add this function to handle PDF generation
  async function generatePDF(content) {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Lecture Notes</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
        <style>
          @media print {
            @page {
              margin: 1in;
              size: A4;
            }
          }
          body {
            font-family: 'Inter', -apple-system, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #1a202c;
            font-size: 11pt;
          }
          .header {
            margin-bottom: 30px;
          }
          .header h1 {
            font-size: 18pt;
            margin: 0;
            font-weight: 600;
            color: #1a202c;
          }
          .header .date {
            font-size: 11pt;
            color: #4a5568;
            margin-top: 8px;
          }
          h2 {
            font-size: 14pt;
            color: #1a202c;
            margin: 25px 0 15px 0;
            font-weight: 600;
          }
          h4 {
            font-size: 11pt;
            color: #1a202c;
            margin: 20px 0 10px 0;
            font-weight: 600;
          }
          p {
            margin: 8px 0;
            line-height: 1.6;
          }
          ul {
            margin: 8px 0;
            padding-left: 0;
            list-style: none;
          }
          li {
            position: relative;
            padding-left: 20px;
            margin: 4px 0;
            line-height: 1.6;
          }
          li::before {
            content: "•";
            position: absolute;
            left: 8px;
            color: #1a202c;
          }
          code {
            font-family: monospace;
            font-size: 10pt;
            color: #1a202c;
          }
          pre {
            margin: 8px 0;
            font-family: monospace;
            font-size: 10pt;
            line-height: 1.4;
            white-space: pre-wrap;
          }
          .code-example {
            margin: 15px 0;
          }
          .code-example h4 {
            margin-bottom: 8px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Lecture Notes</h1>
          <div class="date">${new Date().toLocaleDateString()}</div>
        </div>
        ${formatSummaryForPDF(content)}
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.onload = function() {
      printWindow.print();
      printWindow.onafterprint = function() {
        printWindow.close();
      };
    };
  }

  // Add this new formatting function specifically for PDF
  function formatSummaryForPDF(content) {
    const lines = content.split('\n');
    let formatted = '';
    let inCodeBlock = false;
    
    lines.forEach(line => {
      // Handle section headers (all caps)
      if (line.match(/^[A-Z][A-Z\s&:]+$/)) {
        formatted += `<h2>${line}</h2>`;
        return;
      }

      // Handle code blocks
      if (line.toLowerCase().includes('code example:') || line.toLowerCase().includes('example code:')) {
        formatted += '<div class="code-example"><h4>Code Example</h4>';
        inCodeBlock = true;
        return;
      }

      if (inCodeBlock) {
        // End code block if we see a new section header or end marker
        if (line.match(/^[A-Z][A-Z\s&:]+$/) || line.match(/^=+$/) || line.match(/^-+$/)) {
          formatted += '</div>';
          inCodeBlock = false;
          if (line.match(/^[A-Z][A-Z\s&:]+$/)) {
            formatted += `<h2>${line}</h2>`;
          }
          return;
        }
        formatted += `<pre><code>${line}</code></pre>`;
        return;
      }

      // Handle bullet points (both • and - are common in OpenAI output)
      if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
        if (!formatted.endsWith('</ul>')) {
          formatted += '<ul>';
        }
        formatted += `<li>${line.trim().substring(1).trim()}</li>`;
        return;
      }
      
      if (line.trim() === '' && formatted.endsWith('</ul>')) {
        formatted += '</ul>';
      }

      // Regular text
      if (line.trim()) {
        // Skip separator lines
        if (!line.match(/^[=\-]+$/)) {
          formatted += `<p>${line}</p>`;
        }
      }
    });

    // Close any open lists
    if (formatted.includes('<ul>') && !formatted.endsWith('</ul>')) {
      formatted += '</ul>';
    }

    return formatted;
  }

  // Update processTranscript to handle both cases
  function processTranscript() {
    const transcriptPanel = document.querySelector('.transcript-panel');
    if (!transcriptPanel) {
      console.error('❌ TEST FAILED: Transcript panel not found');
      return;
    }

    const transcriptLines = transcriptPanel.querySelectorAll('.transcript-cues p span');
    if (!transcriptLines || transcriptLines.length === 0) {
      console.error('❌ TEST FAILED: No transcript lines found in panel');
      return;
    }
    
    let fullText = '';
    transcriptLines.forEach((line) => {
      const text = line.textContent.trim();
      if (text) {
        fullText += text + ' ';
      }
    });

    fullText = fullText.trim();
    if (fullText) {
      console.log('✅ TEST PASSED: Transcript extracted successfully');
      getSummaryWithRetry(fullText, 1, 5000);
    } else {
      console.error('❌ TEST FAILED: No transcript text found in panel');
    }
  }

  // Add test message for initial script load
  console.log('✅ TEST PASSED: Content script loaded');
})(); 