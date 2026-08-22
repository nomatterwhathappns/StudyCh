# Google Gemini Setup for Local StudyOS

StudyOS sends Google Gemini requests through its server, so the API key is not placed in the browser or in the AI Settings dialog.

## 1. Create a local environment file

In the same folder as `package.json`, create a file named exactly `.env` and add one line:

```env
GOOGLE_GENERATIVE_AI_API_KEY=your_google_ai_studio_key
```

Use an API key created in Google AI Studio. Keep this file private. The repository's `.gitignore` already excludes `.env` from Git.

## 2. Install and start

Open a PowerShell terminal in the StudyOS folder and run:

```powershell
pnpm install
pnpm dev
```

The development command is configured to run on Windows, macOS, and Linux. Stop and restart `pnpm dev` whenever you add or replace the key.

## 3. Select Gemini in StudyOS

Open **AI settings** in the lower-left sidebar, choose **Google · Gemini 3.6 Flash (your key)**, and save. StudyOS will display whether the server detected the Google key. The Google provider powers Chat, Explain, and Quiz generation.

## Security note

Never paste a real API key into an app form, commit it to Git, or put it in client-side code. If you suspect a key was exposed, revoke it in Google AI Studio and create a replacement.
