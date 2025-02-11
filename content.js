// This file can be empty for now, but we might need it later for more complex interactions 

(function() {
  // Use the selector that we found works
  const transcriptButton = document.querySelector('a.transcript');
  
  if (transcriptButton) {
    console.log('Processing lecture transcript...');
    transcriptButton.click();
    
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
      const formattedSummary = formatSummary(data.choices[0].message.content);
      
      // Get current date and time for filename
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
      
      // Create and download the file
      const blob = new Blob([formattedSummary], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lecture_notes_${timestamp}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('Notes have been downloaded successfully!');
      
    } catch (error) {
      console.error('Error:', error.message);
      if (attempt < maxAttempts) {
        return getSummaryWithRetry(text, attempt + 1, baseDelay * 1.5);
      } else {
        console.error('Failed to generate notes after multiple attempts.');
      }
    }
  }
})(); 