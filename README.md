🎙️ Voice-Based Email Assistant
A full-stack web application that lets you manage your emails using your voice. Compose, read, and send emails hands-free using speech recognition — powered by Google and Microsoft OAuth for seamless email integration.
---
✨ Features
🎤 Voice-controlled email composition and navigation
📧 Gmail & Outlook/Microsoft email integration
🔐 Secure authentication via Google OAuth & Microsoft OAuth
🗄️ MongoDB-backed user data and session management
⚡ Fast, responsive UI built with React + Vite + Tailwind CSS
---
🛠️ Tech Stack
Layer	Technology
Frontend	React, Vite, Tailwind CSS
Backend	Node.js, Express
Database	MongoDB
Auth	JWT, Google OAuth 2.0, Microsoft OAuth
Voice	Web Speech API / Speech Recognition
---
📁 Project Structure
```
voice-assistant/
├── backend/
│   ├── src/
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   ├── index.html
│   └── package.json
└── README.md
```
---
🚀 Getting Started
Prerequisites
Node.js (v18 or higher)
MongoDB (local or Atlas)
Google Cloud Console credentials (for Gmail OAuth)
Microsoft Azure credentials (for Outlook OAuth)
1. Clone the repository
```bash
git clone https://github.com/yourusername/voice-email-assistant.git
cd voice-email-assistant
```
2. Set up the Backend
```bash
cd backend
npm install
cp .env.example .env
```
Fill in your `.env` file (see Environment Variables below).
```bash
npm start
```
3. Set up the Frontend
```bash
cd ../frontend
npm install
npm run dev
```
The app will be running at `http://localhost:5173`
---
🔑 Environment Variables
Create a `.env` file in the `backend/` folder using `.env.example` as a template:
```env
PORT=5000
NODE_ENV=development

MONGODB_URI=your_mongodb_connection_string

JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

SESSION_SECRET=your_session_secret

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/auth/google/callback

MICROSOFT_CLIENT_ID=your_microsoft_client_id
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret
MICROSOFT_CALLBACK_URL=http://localhost:5000/auth/microsoft/callback

FRONTEND_URL=http://localhost:5173
```
> ⚠️ **Never commit your `.env` file.** It is already listed in `.gitignore`.
---
📖 How to Use
Open the app in your browser
Sign in with your Google or Microsoft account
Click the microphone button and speak your command:
"Read my latest emails"
"Compose an email to John"
"Send"
The assistant will handle the rest!
---
🤝 Contributing
Pull requests are welcome! For major changes, please open an issue first.
---
📄 License
This project is licensed under the MIT License.
---
👤 Author
Made by K. Sohan
