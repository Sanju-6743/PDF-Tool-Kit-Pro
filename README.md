# PDF Toolkit Pro

A comprehensive frontend-only PDF toolkit built with HTML, CSS, and JavaScript. All processing happens in the browser using libraries like pdf-lib, pdf.js, and others.

## Features

- **Viewer**: Preview PDFs with zoom and thumbnails
- **Extract Text**: Extract selectable text from PDFs
- **Merge PDFs**: Combine multiple PDFs into one with robust error handling
- **Split PDF**: Split PDF into individual pages
- **AI Chatbot**: Summarize documents using Gemini AI
- **Create from Text**: Generate PDFs from text input
- **Images to PDF**: Convert images to PDF
- **Watermark**: Add text watermarks
- **Reorder Pages**: Drag to reorder pages
- **Compress PDF**: Basic compression by downscaling images
- **Rotate Pages**: Rotate specific pages
- **Delete Pages**: Remove pages
- **Extract Pages**: Extract specific pages
- **Add Page Numbers**: Number pages
- **Add Custom Text**: Add text to pages
- **Annotate**: Highlight, underline, notes, drawings
- **Draw Shapes**: Rectangles, circles, arrows, lines
- **Fill Forms**: Fill PDF form fields
- **Edit Metadata**: Update title, author, subject
- **Password Protect**: Add password protection
- **Unlock PDF**: Remove password protection
- **PDF to Images**: Convert pages to images
- **Extract Images**: Extract embedded images
- **OCR**: Extract text from images using Tesseract.js
- **Add Signature**: Add digital signatures
- **Search PDF**: Search for text within PDFs

## Technologies Used

- **pdf-lib**: PDF creation and manipulation
- **pdf.js**: PDF rendering and text extraction
- **jsPDF**: Additional PDF generation
- **Tesseract.js**: OCR functionality
- **JSZip**: ZIP file creation
- **FileSaver.js**: File downloads
- **SweetAlert2**: User notifications
- **Anime.js**: Animations
- **Mammoth.js**: DOCX text extraction
- **Gemini AI**: Document summarization (requires API key)

## Project Structure

```
/
├── index.html          # Main HTML file
├── css/
│   └── style.css       # Stylesheets
├── js/
│   └── script.js       # JavaScript functionality
├── vercel.json         # Vercel deployment config
└── README.md           # This file
```

## Deployment to Vercel

1. **Prerequisites**:
   - GitHub account
   - Vercel account (free tier available)

2. **Setup Repository**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/Sanju-6743/PDF-Tool-Kit-Pro.git
   git push -u origin main
   ```

3. **Deploy on Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click "Import Project"
   - Connect your GitHub account
   - Select the repository `PDF-Tool-Kit-Pro`
   - Vercel will automatically detect the configuration
   - Click "Deploy"

4. **Configuration**:
   - The `vercel.json` file configures Vercel to serve the static files
   - All processing is client-side, no server required

## Usage

1. Open the deployed URL in your browser
2. Select a tool from the sidebar
3. Upload files using the buttons or drag & drop
4. Configure options as needed
5. Click the action button to process
6. Download the result

## Important Notes

- **Frontend-Only**: All PDF processing happens in the browser. Large files may cause performance issues.
- **API Key**: The AI Chatbot requires a Google Gemini API key. Replace the placeholder in `script.js` with your own key for production use.
- **Security**: Never expose sensitive API keys in client-side code. Consider using a proxy server for production.
- **Browser Compatibility**: Works best in modern browsers with good WebAssembly support.
- **File Size Limits**: Large PDFs may exceed browser memory limits.

## Development

To run locally:
1. Clone the repository
2. Open `index.html` in a modern web browser
3. No build process required

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source. Feel free to use and modify as needed.

## Author

Sanju - PDF Toolkit Pro
