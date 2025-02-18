function convertToLaTeX(content) {
    let latex = `\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{hyperref}
\\usepackage{verbatim}
\\usepackage[utf8]{inputenc}
\\usepackage{graphicx}
\\usepackage{forest}

\\begin{document}

\\title{Lecture Notes}
\\author{\\today}
\\maketitle\n\n`;

    const lines = content.split('\n');
    let inCodeBlock = false;
    let inItemize = false;

    for (const line of lines) {
        if (line.trim().length === 0) {
            latex += '\n';
            continue;
        }

        // Handle code blocks
        if (line.startsWith('```')) {
            if (!inCodeBlock) {
                latex += '\\begin{verbatim}\n';
                inCodeBlock = true;
                // Skip the language identifier line (e.g., ```python)
                if (trimmedLine.length > 3) {
                    return;
                }
            } else {
                latex += '\\end{verbatim}\n\n';
                inCodeBlock = false;
            }
            return;
        }

        if (inCodeBlock) {
            latex += line + '\n';
            continue;
        }

        // Handle headers
        if (line.match(/^#{1,6}\s/)) {
            const level = line.match(/^(#{1,6})\s/)[1].length;
            let text = line.replace(/^#{1,6}\s/, '')
                         .replace(/\*\*/g, '')
                         .replace(/^\d+\.\s*/, '')
                         .trim();
            
            text = text.replace(/:[a-z_]+:/g, match => emojiMap[match] || match);

            switch(level) {
                case 1:
                    latex += `\\section{${text}}\n\n`;
                    break;
                case 2:
                    latex += `\\subsection{${text}}\n\n`;
                    break;
                case 3:
                    latex += `\\subsubsection{${text}}\n\n`;
                    break;
            }
            continue;
        }

        // Handle bullet points
        if (line.match(/^[\s-]*[-•]\s/)) {
            if (!inItemize) {
                latex += '\\begin{itemize}\n';
                inItemize = true;
            }
            let text = line.replace(/^[-*•]\s+/, '');
            
            text = text.replace(/\*\*(.*?)\*\*/g, '\\textbf{$1}');
            text = text.replace(/\*(.*?)\*/g, '\\textit{$1}');
            text = text.replace(/:[a-z_]+:/g, match => emojiMap[match] || match);
            
            latex += '    \\item ' + text + '\n';
            continue;
        } else if (inItemize) {
            latex += '\\end{itemize}\n\n';
            inItemize = false;
        }

        // Handle regular text
        let text = line.trim();
        text = text.replace(/\*\*(.*?)\*\*/g, '\\textbf{$1}');
        text = text.replace(/\*(.*?)\*/g, '\\textit{$1}');
        text = text.replace(/:[a-z_]+:/g, match => emojiMap[match] || match);
        latex += text + '\n';
    }

    // Close any open environments
    if (inItemize) {
        latex += '\\end{itemize}\n';
    }

    latex += '\\end{document}';
    return latex;
}

window.generatePDF = async function(content) {
    try {
        // Create PDF document
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        const lineHeight = 7;
        let y = margin;

        // Convert content to LaTeX
        const latexContent = convertToLaTeX(content);
        
        // Process LaTeX content line by line
        const lines = latexContent.split('\n');
        let inCodeBlock = false;
        let inMathBlock = false;
        let inItemize = false;

        for (const line of lines) {
            // Check for page break
            if (y + lineHeight > pageHeight - margin) {
                doc.addPage();
                y = margin;
            }

            // Skip LaTeX commands we don't need to render
            if (line.match(/^\\(documentclass|usepackage|begin{document}|end{document}|title|author|maketitle)/)) {
                continue;
            }

            // Handle sections
            if (line.startsWith('\\section{')) {
                const text = line.replace(/\\section{(.*?)}/, '$1');
                doc.setFontSize(16);
                doc.setFont('helvetica', 'bold');
                y += lineHeight * 2;
                doc.text(text, margin, y);
                y += lineHeight * 2;
                continue;
            }

            if (line.startsWith('\\subsection{')) {
                const text = line.replace(/\\subsection{(.*?)}/, '$1');
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                y += lineHeight;
                doc.text(text, margin + 5, y);
                y += lineHeight * 1.5;
                continue;
            }

            if (line.startsWith('\\subsubsection{')) {
                const text = line.replace(/\\subsubsection{(.*?)}/, '$1')
                                .replace(/^\d+\s+/, '');  // Remove any leading numbers
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                y += lineHeight;
                doc.text(text, margin + 10, y);
                y += lineHeight * 1.5;
                continue;
            }

            // Handle itemize
            if (line.startsWith('\\begin{itemize}')) {
                inItemize = true;
                continue;
            }

            if (line.startsWith('\\end{itemize}')) {
                inItemize = false;
                y += lineHeight;
                continue;
            }

            if (line.trim().startsWith('\\item')) {
                const text = line.replace(/\\item\s*/, '').trim();
                doc.setFontSize(11);
                doc.setFont('helvetica', 'normal');
                doc.text('•', margin, y);
                
                // Handle formatting in item text
                const parts = text.split(/(\\\w+{.*?})/g);
                let x = margin + 5;
                
                parts.forEach(part => {
                    if (part.startsWith('\\textbf{')) {
                        const boldText = part.replace(/\\textbf{(.*?)}/, '$1');
                        doc.setFont('helvetica', 'bold');
                        doc.text(boldText, x, y);
                        x += doc.getTextWidth(boldText);
                        doc.setFont('helvetica', 'normal');
                    } else if (part.startsWith('\\textit{')) {
                        const italicText = part.replace(/\\textit{(.*?)}/, '$1');
                        doc.setFont('helvetica', 'italic');
                        doc.text(italicText, x, y);
                        x += doc.getTextWidth(italicText);
                        doc.setFont('helvetica', 'normal');
                    } else if (part.trim()) {
                        doc.text(part, x, y);
                        x += doc.getTextWidth(part);
                    }
                });
                
                y += lineHeight;
                continue;
            }

            // Handle regular text
            if (line.trim()) {
                doc.setFontSize(11);
                doc.setFont('helvetica', 'normal');
                
                // Handle inline formatting
                const parts = line.split(/(\\\w+{.*?})/g);
                let x = margin;
                
                parts.forEach(part => {
                    if (part.startsWith('\\textbf{')) {
                        const boldText = part.replace(/\\textbf{(.*?)}/, '$1');
                        doc.setFont('helvetica', 'bold');
                        doc.text(boldText, x, y);
                        x += doc.getTextWidth(boldText);
                        doc.setFont('helvetica', 'normal');
                    } else if (part.startsWith('\\textit{')) {
                        const italicText = part.replace(/\\textit{(.*?)}/, '$1');
                        doc.setFont('helvetica', 'italic');
                        doc.text(italicText, x, y);
                        x += doc.getTextWidth(italicText);
                        doc.setFont('helvetica', 'normal');
                    } else if (part.trim()) {
                        doc.text(part, x, y);
                        x += doc.getTextWidth(part);
                    }
                });
                
                y += lineHeight;
            }
        }

        // Save the PDF
        const filename = `lecture_notes_${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
        doc.save(filename);
        console.log('✅ PDF generated successfully:', filename);
        return true;
    } catch (error) {
        console.error('❌ PDF Generation Error:', error);
        throw error;
    }
};

// Emoji mapping
const emojiMap = {
    ':check:': '✅',
    ':x:': '❌',
    ':warning:': '⚠️',
    ':brain:': '🧠',
    ':bulb:': '💡',
    ':book:': '📚',
    ':pencil:': '📝',
    ':rocket:': '🚀',
    ':star:': '⭐',
    ':point_right:': '👉',
    ':graduation_cap:': '🎓',
    ':calendar:': '📅',
    ':computer:': '💻',
    ':chart:': '📊',
    ':diamond:': '🔹'
};
