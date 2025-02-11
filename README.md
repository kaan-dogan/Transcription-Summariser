# Lecture Summarizer Extension 🎓

A Chrome extension that automatically generates detailed lecture notes from Echo360 lecture transcripts using OpenAI's GPT-3.5 model.

## ✨ Features

- 📝 Automatically extracts lecture transcripts from Echo360 video pages
- 🤖 Generates comprehensive lecture notes including:
  - Implementation details and syntax
  - Code examples and practical applications
  - Best practices and common pitfalls
  - Performance considerations
  - Real-world use cases
- 💾 Downloads notes as formatted text files with timestamps
- 🔄 Handles rate limiting and retries automatically
- 📊 Preserves code examples with proper formatting

## 🚀 Installation

1. Download the extension
   - Download this repository as a ZIP file
   - Extract to your preferred location

2. Configure the extension
   - Copy `config.template.js` to `config.js`
   - Add your OpenAI API key to `config.js`
   ```javascript
   window.config = {
     OPENAI_API_KEY: 'Bearer YOUR_API_KEY_HERE'
   };
   ```

3. Load in Chrome
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked" and select the extension directory

## 📖 Usage

1. Navigate to an Echo360 lecture page
2. Click the extension icon in your Chrome toolbar
3. The extension will automatically:
   - Locate and click the transcript button
   - Extract the lecture content
   - Generate detailed notes using GPT-3.5
   - Download the formatted notes as a text file

## 🛠️ Technical Details

### API Configuration
- Model: GPT-3.5-turbo-16k
- Max tokens: 2000
- Temperature: 0.2
- Automatic retry logic for rate limits

### Note Generation Format
1. **Implementation & Syntax**
   - Method signatures
   - Code examples
   - Implementation requirements

2. **Practical Details**
   - Advantages/disadvantages
   - Performance characteristics
   - Memory considerations
   - Use cases

3. **Examples & Applications**
   - Code samples
   - Real-world scenarios
   - Usage variations
   - Edge cases

4. **Best Practices & Warnings**
   - Tips and tricks
   - Common pitfalls
   - Best practices
   - Important cautions

5. **Comparisons & Alternatives**
   - Similar approaches
   - Trade-offs
   - Selection criteria

## 🔧 Development

### Prerequisites
- Chrome browser
- OpenAI API key
- JavaScript knowledge

### Local Development
1. Make code changes
2. Refresh extension in `chrome://extensions/`
3. Test on Echo360 lectures

## ❗ Troubleshooting

Common issues:
- **Transcript Not Found**: Verify you're on an Echo360 lecture page
- **API Errors**: Check API key format and quota
- **Rate Limits**: Extension will retry automatically

## 📋 Limitations

- Echo360 platform only
- Requires OpenAI API key
- Subject to API rate limits
- Token limit constraints

## 🙏 Acknowledgments

- Echo360 platform
- OpenAI GPT-3.5 API

