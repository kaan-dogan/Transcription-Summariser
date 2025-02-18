// This file can be empty for now, but we might need it later for more complex interactions 

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
  
  // Main functionality
  const transcriptButton = document.querySelector('a.transcript');
  
  async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function formatSummary(content) {
    const lines = content.split('\n');
    let formatted = '';
    let inTable = false;
    let inCode = false;

    // Helper function to format mathematical expressions
    function formatMath(text) {
      return text
        // Format summation
        .replace(/sum\((.*?)\)/, '∑($1)')
        // Format theta
        .replace(/theta/g, 'θ')
        // Format multiplication
        .replace(/\*/g, '×')
        // Format subscripts
        .replace(/\_(\d+)/g, '₍$1₎')
        // Format superscripts
        .replace(/\^(\d+)/g, '⁽$1⁾')
        // Format greater than or equal
        .replace(/>=/g, '≥')
        // Format less than or equal
        .replace(/<=/g, '≤')
        // Format fractions
        .replace(/(\d+)\/(\d+)/g, '⁽$1⁄$2⁾')
        // Format vectors
        .replace(/\\vec\{(.*?)\}/g, '⟨$1⟩');
    }

    // Helper function to format headings
    function formatHeading(text) {
      if (text.startsWith('###')) {
        // Subsubheading - smaller, italic
        return `<span style="color: #666; font-style: italic; font-size: 0.9em;">${text.replace(/^###\s*/, '')}</span>`;
      } else if (text.startsWith('##')) {
        // Subheading - medium, blue
        return `<span style="color: #1a73e8; font-weight: bold;">${text.replace(/^##\s*/, '')}</span>`;
      } else if (text.startsWith('#')) {
        // Main heading - large, dark blue
        return `<span style="color: #174ea6; font-weight: bold; font-size: 1.1em;">${text.replace(/^#\s*/, '')}</span>`;
      }
      return text;
    }

    lines.forEach(line => {
      // Handle headings
      if (line.startsWith('#')) {
        formatted += formatHeading(line) + '\n\n';
        return;
      }

      // Handle truth tables
      if (line.includes('Inputs & Outputs:') || line.includes('Input (x1, x2)')) {
        inTable = true;
        formatted += '\n' + line + '\n';
        return;
      }

      if (inTable) {
        if (line.trim() === '') {
          inTable = false;
          formatted += '\n';
        } else {
          const cells = line.split('|').map(cell => cell.trim());
          formatted += cells.join('\t') + '\n';
        }
        return;
      }

      // Handle code blocks
      if (line.toLowerCase().includes('python code for')) {
        inCode = true;
        formatted += '\n⬛ ' + line + '\n\n';
        return;
      }

      if (line.trim().startsWith('```python')) {
        formatted += 'python\n';
        return;
      }

      if (line.trim() === '```') {
        inCode = false;
        formatted += '\n';
        return;
      }

      if (inCode) {
        formatted += line + '\n';
        return;
      }

      // Handle mathematical formulas
      if (line.includes('f(z)') || line.includes('sum') || line.includes('theta')) {
        formatted += formatMath(line) + '\n';
        return;
      }

      // Handle section headers
      if (line.match(/^\d+\.\d+/)) {
        if (line.includes('(Not Linearly Separable)')) {
          formatted += '\n❌ ' + line + '\n';
        } else {
          formatted += '\n✅ ' + line + '\n';
        }
        return;
      }

      // Handle bullet points
      if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
        if (line.toLowerCase().includes('cannot')) {
          formatted += '⚠️ ' + line.substring(1).trim() + '\n';
        } else if (line.toLowerCase().startsWith('• why?')) {
          formatted += '✅ ' + line.substring(1).trim() + '\n';
        } else {
          formatted += '✅ ' + line.substring(1).trim() + '\n';
        }
        return;
      }

      // Regular text
      if (line.trim()) {
        // Check if line contains mathematical expressions
        if (line.match(/[+\-*/=><{}\[\]]/)) {
          formatted += formatMath(line) + '\n';
        } else {
          formatted += line + '\n';
        }
      }
    });

    return formatted;
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

      // Find transcript button with more specific selector
      const transcriptButton = document.querySelector('a.transcript, button.transcript');
      console.log('Transcript button found:', !!transcriptButton);
      console.log('Transcript button:', transcriptButton);
      
      if (!transcriptButton) {
        throw new Error('Transcript button not found - Are you on an Echo360 lecture page?');
      }

      // Check if panel is already visible
      const transcriptPanel = document.querySelector('.transcript-panel');
      console.log('Transcript panel found:', !!transcriptPanel);
      console.log('Transcript panel display:', transcriptPanel ? window.getComputedStyle(transcriptPanel).display : 'N/A');

      if (!transcriptPanel || window.getComputedStyle(transcriptPanel).display === 'none') {
        console.log('Opening transcript panel...');
        transcriptButton.click();
        await delay(1500); // Wait for panel to open
      }

      // Get transcript lines
      const transcriptLines = document.querySelectorAll('.transcript-cues p span, .transcript-text');
      console.log('Number of transcript lines found:', transcriptLines.length);
      
      if (!transcriptLines || transcriptLines.length === 0) {
        throw new Error('No transcript found - Try refreshing the page');
      }

      // Collect all text in one go
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
      if (window.devMode) {
        console.log('Dev mode: Skipping OpenAI request');
        const sampleContent = `# Lecture Notes
## Overview
• This is a sample note
• Testing formatting

### Code Example
\`\`\`python
def example():
    print("Hello")
\`\`\`

### Mathematical Formulas
f(z) = sum(w_i * x_i) + theta
`;

        switch (window.downloadFormat) {
          case 'pdf':
            await generatePDF(formatSummary(sampleContent));
            break;
          case 'md':
            downloadFile(sampleContent, `lecture_notes_${getTimestamp()}.md`, 'text/markdown');
            break;
          default: // txt
            downloadFile(formatSummary(sampleContent), `lecture_notes_${getTimestamp()}.txt`, 'text/plain');
        }
        return;
      }

      if (attempt > 1) {
        console.log(`Retrying line... (${attempt}/${maxAttempts})`);
        await delay(delayMs);
      }

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
          max_tokens: 16384,
          temperature: 0.2
        })
      }).catch(error => {
        console.error('Fetch error:', error);
        throw new Error(`API request failed: ${error.message}`);
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API Error:', errorData);
        throw new Error(`API returned ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      if (!data.choices || !data.choices[0]) {
        throw new Error('Invalid response format from API');
      }

      const content = data.choices[0].message.content;
      
      // Format the content as LaTeX-style markdown
      const formattedContent = formatAsLatex(content);
      
      // Generate PDF
      await generatePDF(formattedContent);
      
      console.log('✅ TEST PASSED: Notes generated and downloaded successfully');
      
    } catch (error) {
      console.error('❌ ERROR:', error.message);
      
      // Handle network errors
      if (error.name === 'AbortError') {
        console.log('Request timed out, retrying...');
        if (attempt < maxAttempts) {
          return await getSummaryWithRetry(text, attempt + 1, baseDelay);
        }
      }
      
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        console.log('Network error, retrying...');
        if (attempt < maxAttempts) {
          return await getSummaryWithRetry(text, attempt + 1, baseDelay);
        }
      }

      if (attempt < maxAttempts) {
        console.log(`Attempt ${attempt} failed, retrying...`);
        return await getSummaryWithRetry(text, attempt + 1, baseDelay * 1.5);
      } else {
        console.error('Failed to generate notes after multiple attempts.');
        status.textContent = 'Failed to generate notes. Please try again.';
      }
    }
  }

  function formatAsLatex(content) {
    let formatted = '';
    
    // Add document preamble
    formatted += `\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{hyperref}
\\usepackage{verbatim}
\\usepackage[utf8]{inputenc}
\\usepackage{graphicx}
\\usepackage{forest}  % For tree structures

\\begin{document}

\\title{Lecture Notes}
\\author{\\today}
\\maketitle\n\n`;

    // Process content sections
    const lines = content.split('\n');
    let inCodeBlock = false;
    let inItemize = false;
    let sectionNumber = 1;
    let subsectionNumber = 1;

    lines.forEach(line => {
        const trimmedLine = line.trim();
        
        // Skip empty lines
        if (!trimmedLine) {
            formatted += '\n';
            return;
        }

        // Handle code blocks
        if (trimmedLine.startsWith('```')) {
            if (!inCodeBlock) {
                formatted += '\\begin{verbatim}\n';
                inCodeBlock = true;
                // Skip the language identifier line (e.g., ```python)
                if (trimmedLine.length > 3) {
                    return;
                }
            } else {
                formatted += '\\end{verbatim}\n\n';
                inCodeBlock = false;
            }
            return;
        }

        if (inCodeBlock) {
            // Preserve exact code formatting, including indentation and whitespace
            formatted += line + '\n';
            return;
        }

        // Handle sections and subsections
        if (trimmedLine.match(/^#{1,3}\s/)) {
            const level = trimmedLine.match(/^(#{1,3})\s/)[1].length;
            let text = trimmedLine.replace(/^#{1,3}\s/, '')  // Remove markdown headers
                        .replace(/\*\*/g, '')         // Remove markdown bold
                        .replace(/^\d+\.\s*/, '')     // Remove any numbering
                        .trim();

            // Convert emoji shortcuts
            text = text.replace(/:[a-z_]+:/g, match => emojiMap[match] || match);

            // Use proper LaTeX sectioning
            switch (level) {
                case 1:
                    formatted += `\\section{${text}}\n\n`;
                    break;
                case 2:
                    formatted += `\\subsection{${text}}\n\n`;
                    break;
                case 3:
                    formatted += `\\subsubsection{${text}}\n\n`;
                    break;
            }
            return;
        }

        // Handle bullet points
        if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ') || trimmedLine.startsWith('•')) {
            if (!inItemize) {
                formatted += '\\begin{itemize}\n';
                inItemize = true;
            }
            let text = trimmedLine.replace(/^[-*•]\s+/, '');
            
            // Convert markdown formatting to LaTeX
            text = text.replace(/\*\*(.*?)\*\*/g, '\\textbf{$1}');
            text = text.replace(/\*(.*?)\*/g, '\\textit{$1}');
            text = text.replace(/:[a-z_]+:/g, match => emojiMap[match] || match);
            
            // Add proper indentation for LaTeX itemize
            formatted += '    \\item ' + text + '\n';
            return;
        } else if (inItemize) {
            formatted += '\\end{itemize}\n\n';
            inItemize = false;
        }

        // Handle math blocks
        if (trimmedLine.includes('$begin:math:display$')) {
            formatted += '\\begin{align*}\n';
            let math = trimmedLine.replace(/\$begin:math:display\$(.*?)\$end:math:display\$/g, '$1');
            
            // Clean up math notation
            math = math
                .replace(/\\\\/g, '\\\\\\\\')  // Fix line breaks in align*
                .replace(/\\sum_/g, '\\sum\\limits_')  // Better sum notation
                .replace(/\\cdot/g, '\\cdot ')  // Add space after multiplication
                .replace(/\*/g, '\\cdot ')  // Convert * to proper multiplication
                .replace(/theta/g, '\\theta')  // Proper theta symbol
                .replace(/>=/g, '\\geq')  // Proper greater than or equal
                .replace(/<=/g, '\\leq')  // Proper less than or equal
                .replace(/\b(\d+)\/(\d+)\b/g, '\\frac{$1}{$2}')  // Proper fractions
                .replace(/\bsin\b/g, '\\sin')  // Proper trig functions
                .replace(/\bcos\b/g, '\\cos')
                .replace(/\btan\b/g, '\\tan')
                .replace(/\bexp\b/g, '\\exp')
                .replace(/\blog\b/g, '\\log')
                .replace(/\bln\b/g, '\\ln')
                .replace(/\^(\w+)/g, '^{$1}')  // Proper superscripts
                .replace(/_(\w+)/g, '_{$1}');  // Proper subscripts
            
            formatted += math + '\n\\end{align*}\n\n';
            return;
        }

        if (trimmedLine.includes('$begin:math:text$')) {
            let math = trimmedLine.replace(/\$begin:math:text\$(.*?)\$end:math:text\$/g, '$1');
            
            // Clean up inline math notation
            math = math
                .replace(/\*/g, '\\cdot ')
                .replace(/theta/g, '\\theta')
                .replace(/>=/g, '\\geq')
                .replace(/<=/g, '\\leq')
                .replace(/\b(\d+)\/(\d+)\b/g, '\\frac{$1}{$2}')
                .replace(/\bsin\b/g, '\\sin')
                .replace(/\bcos\b/g, '\\cos')
                .replace(/\btan\b/g, '\\tan')
                .replace(/\bexp\b/g, '\\exp')
                .replace(/\blog\b/g, '\\log')
                .replace(/\bln\b/g, '\\ln')
                .replace(/\^(\w+)/g, '^{$1}')
                .replace(/_(\w+)/g, '_{$1}');
            
            formatted += `$${math}$`;
            return;
        }

        // Handle tree structures
        if (trimmedLine.startsWith('tree:')) {
            formatted += '\\begin{forest}\n  for tree={draw,\n    parent anchor=south,\n    child anchor=north,\n    align=center}\n';
            
            // Remove the 'tree:' prefix and split into lines
            const treeLines = trimmedLine.substring(5).trim().split('\n');
            let lastIndentLevel = 0;
            let brackets = [];
            
            treeLines.forEach((line, index) => {
                const indentLevel = line.match(/^\s*/)[0].length;
                const node = line.trim();
                
                // Handle indentation changes
                if (indentLevel > lastIndentLevel) {
                    // Going deeper - open new branch
                    formatted += '    '.repeat(lastIndentLevel) + '[' + node + '\n';
                    brackets.push(']');
                } else if (indentLevel < lastIndentLevel) {
                    // Going back - close branches
                    const levelsToClose = (lastIndentLevel - indentLevel);
                    formatted += '    '.repeat(lastIndentLevel) + 
                                brackets.splice(-levelsToClose).join('\n' + '    '.repeat(indentLevel)) + 
                                '\n' + '    '.repeat(indentLevel) + '[' + node + '\n';
                    brackets.push(']');
                } else {
                    // Same level - close previous node and start new one
                    if (index > 0) {
                        formatted += '    '.repeat(indentLevel) + brackets.pop() + '\n';
                    }
                    formatted += '    '.repeat(indentLevel) + '[' + node + '\n';
                    brackets.push(']');
                }
                
                lastIndentLevel = indentLevel;
            });
            
            // Close any remaining brackets
            while (brackets.length > 0) {
                const level = brackets.length - 1;
                formatted += '    '.repeat(level) + brackets.pop() + '\n';
            }
            
            formatted += '\\end{forest}\n\n';
            return;
        }

        // Handle regular text
        let text = trimmedLine;
        text = text.replace(/\*\*(.*?)\*\*/g, '\\textbf{$1}');
        text = text.replace(/\*(.*?)\*/g, '\\textit{$1}');
        text = text.replace(/:[a-z_]+:/g, match => emojiMap[match] || match);
        formatted += text + '\n';
    });

    // Close any open environments
    if (inItemize) {
        formatted += '\\end{itemize}\n';
    }

    formatted += '\\end{document}';
    return formatted;
  }

  // Add this function to handle PDF generation
  async function generatePDF(content) {
    try {
      if (typeof window.generatePDF !== 'function') {
        throw new Error('PDF generator not loaded');
      }
      
      // Add a small delay to ensure jsPDF is fully initialized
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await window.generatePDF(content);
      console.log('✅ PDF generated successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. See console for details.');
    }
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

  // Add debug logging to the message listener
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);
    if (request.action === 'generateNotes') {
      console.log('Received generateNotes request with format:', request.format);
      console.log('Dev mode:', request.devMode);
      window.downloadFormat = request.format;
      window.devMode = request.devMode;
      processTranscript(); // Call once per message
    }
  });

  // Add test message for initial script load
  console.log('✅ TEST PASSED: Content script loaded');
})(); 