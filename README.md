# PDF Toolkit Pro with Authentication

A comprehensive PDF processing toolkit with user authentication and database tracking.

## Features

- **PDF Processing Tools**: Merge, split, compress, extract text, OCR, watermark, and more
- **User Authentication**: Login/signup with Supabase Auth
- **Database Tracking**: Track file uploads and processing statistics
- **Modern UI**: Clean, responsive design with dark/light themes
- **Client-side Processing**: All operations run in the browser

## Setup Instructions

### 1. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your project URL and anon key
3. Go to the SQL Editor and run the commands from `supabase_setup.sql`

### 2. Update Configuration

In `js/script.js`, update the Supabase configuration:

```javascript
const SUPABASE_URL = 'https://your-project.supabase.co'; // Replace with your Supabase URL
const SUPABASE_ANON_KEY = 'your-anon-key-here'; // Replace with your anon key
```

### 3. Deploy to Vercel

1. Install Vercel CLI: `npm install -g vercel`
2. Login: `vercel login`
3. Deploy: `vercel --prod`

### 4. Environment Variables (Optional)

For production, set these environment variables in Vercel:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## Database Schema

### user_stats
- Tracks user file upload and processing statistics
- Row Level Security enabled

### file_uploads
- Logs all file operations
- Linked to authenticated users

## Usage

1. Sign up or login
2. Upload PDFs using the tools
3. Process files with various operations
4. View statistics in the top counters
5. Logout when done

## Security

- All authentication handled by Supabase
- Row Level Security prevents users from accessing others' data
- Client-side processing ensures privacy

## Technologies

- HTML5, CSS3, JavaScript (ES6+)
- Supabase (Auth + Database)
- PDF-lib, PDF.js, Tesseract.js
- SweetAlert2, Anime.js
- Vercel (Deployment)
