// This file can be empty for now, but we might need it later for more complex interactions 

(function() {
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
    }
  });

  // Main functionality
  const transcriptButton = document.querySelector('a.transcript');
  
  if (transcriptButton) {
    console.log('Processing lecture transcript...');
    
    // Check if transcript panel is already open
    const transcriptPanel = document.querySelector('.transcript-panel');
    if (!transcriptPanel || !transcriptPanel.offsetParent) {
      // Only click if panel is not visible
      transcriptButton.click();
    }
    
    // Wait 1 second then get transcript
    setTimeout(() => {
      const transcriptPanel = document.querySelector('.transcript-panel');
      if (transcriptPanel) {
        const transcriptLines = transcriptPanel.querySelectorAll('.transcript-cues p span');
        
        let fullText = '';
        transcriptLines.forEach((line) => {
          const text = line.textContent.trim();
          if (text) {
            fullText += text + ' ';
          }
        });

        fullText = fullText.trim();
        getSummaryWithRetry(fullText, 1, 5000);
      } else {
        console.error('Transcript panel not found');
      }
    }, 1000);
  } else {
    console.error('Transcript button not found - Please make sure you are on a lecture page with transcripts enabled');
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
      
    } catch (error) {
      console.error('Error:', error.message);
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
        <link href="https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700;900&family=Fira+Code:wght@400;500&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          @media print {
            @page {
              margin: 1in;
              size: A4;
            }
          }
          body {
            font-family: 'Inter', -apple-system, sans-serif;
            line-height: 1.7;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
            color: #1a202c;
            font-size: 11pt;
            background: #fff;
          }
          .header {
            text-align: center;
            margin-bottom: 50px;
            padding: 30px;
            background: #f8fafc;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
          }
          .header h1 {
            color: #1a202c;
            font-size: 32pt;
            margin: 0;
            font-weight: 900;
            letter-spacing: -0.03em;
            font-family: 'Merriweather', Georgia, serif;
          }
          .header .date {
            font-size: 11pt;
            color: #64748b;
            margin-top: 12px;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          section {
            margin: 30px 0;
            page-break-inside: avoid;
          }
          h2 {
            font-size: 18pt;
            color: #1a202c;
            margin: 35px 0 20px 0;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 10px;
            font-weight: 900;
            letter-spacing: -0.02em;
            font-family: 'Merriweather', Georgia, serif;
          }
          h3 {
            font-size: 14pt;
            color: #1a202c;
            margin: 25px 0 15px 0;
            font-weight: 700;
            font-family: 'Merriweather', Georgia, serif;
          }
          p {
            margin: 12px 0;
            text-align: justify;
            hyphens: auto;
            line-height: 1.8;
          }
          code {
            font-family: 'Fira Code', monospace;
            background: #f1f5f9;
            padding: 3px 6px;
            font-size: 10pt;
            border-radius: 4px;
            color: #0f766e;
            font-weight: 500;
            letter-spacing: -0.02em;
          }
          pre {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            font-family: 'Fira Code', monospace;
            font-size: 10pt;
            line-height: 1.6;
            white-space: pre-wrap;
            page-break-inside: avoid;
            color: #1e293b;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          }
          ul, ol {
            padding-left: 25px;
            margin: 15px 0;
          }
          li {
            margin: 10px 0;
            text-align: justify;
            line-height: 1.7;
            padding-left: 5px;
          }
          .code-example {
            margin: 30px 0;
            page-break-inside: avoid;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 25px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          }
          .code-example h4 {
            font-size: 12pt;
            margin: 0 0 15px 0;
            color: #475569;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            font-weight: 700;
            font-family: 'Inter', sans-serif;
          }
          .separator {
            border: none;
            border-top: 2px solid #e2e8f0;
            margin: 30px 0;
          }
          strong {
            font-weight: 700;
            color: #1a202c;
          }
          /* Bullet point styling */
          ul {
            list-style: none;
          }
          ul li::before {
            content: "•";
            color: #3b82f6;
            font-weight: bold;
            display: inline-block;
            width: 1em;
            margin-left: -1em;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Lecture Notes</h1>
          <div class="date">${new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</div>
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
      // Handle section headers (lines with all caps and ====)
      if (line.match(/^[A-Z][A-Z\s&:]+$/) && lines[lines.indexOf(line) + 1]?.includes('===')) {
        formatted += `<h2>${line}</h2>`;
        return;
      }
      
      // Skip separator lines
      if (line.match(/^=+$/)) {
        return;
      }

      // Handle code blocks
      if (line.includes('CODE EXAMPLE:')) {
        formatted += '<div class="code-example"><h4>Code Example</h4>';
        inCodeBlock = true;
        return;
      }

      if (inCodeBlock) {
        if (line.match(/^=+$/)) {
          formatted += '</div>';
          inCodeBlock = false;
        } else {
          formatted += `<pre><code>${line}</code></pre>`;
        }
        return;
      }

      // Handle bullet points
      if (line.startsWith('• ')) {
        if (!formatted.endsWith('</ul>')) {
          formatted += '<ul>';
        }
        formatted += `<li>${line.substring(2)}</li>`;
        return;
      }
      
      if (line.trim() === '' && formatted.endsWith('</ul>')) {
        formatted += '</ul>';
      }

      // Regular text
      if (line.trim()) {
        formatted += `<p>${line}</p>`;
      }
    });

    return formatted;
  }
})(); 