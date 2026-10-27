# Personal Agent

A personal AI chatbot designed to provide natural, interactive conversations through a clean and responsive interface.

## Features

- **AI-Powered Conversations** — Chat with an AI assistant.
- **Multiple Personalities** — Choose different conversational styles.
- **Authentication** — Secure user authentication with Supabase.
- **Conversation History** — Save and revisit previous conversations.
- **Memory** — Maintain relevant conversational context.
- **Voice Input** — Speak instead of typing where browser support is available.
- **Image Support** — Attach images for supported AI interactions.
- **Emoji Picker** — Insert emojis directly into messages.
- **Responsive UI** — Designed for desktop and mobile devices.
- **Light and Dark Themes** — Switch between visual themes.

## Tech Stack

**Frontend**
- React
- TypeScript
- Vite
- Tailwind CSS
- Lucide React

**Backend**
- Node.js
- Express.js
- TypeScript

**Database & Authentication**
- Supabase

**AI Integration**
- Google Gemini API

## Project Structure

```text
chat-bot/
├── client/       # React frontend
├── server/       # Node.js backend
├── shared/       # Shared code, if configured
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites

- Node.js and npm
- A Supabase project
- A configured Gemini API key

### Installation

Clone the repository:

```bash
git clone https://github.com/afnankhan6971-cloud/Friend-Agent.git
cd Friend-Agent
```

Install dependencies in the relevant client and server directories:

```bash
cd client
npm install
```

Configure the required environment variables using the project's `.env.example` files. Never commit actual API keys or `.env` files.

Follow the scripts and configuration defined in the client and server `package.json` files to run the application.

## Security

- Keep API keys and credentials private.
- Never commit `.env` files or expose secrets in source code.
- Use appropriate Supabase Row Level Security policies.

## Project Status

Under active development. Features and setup requirements may evolve.

## Author

Afnan Khan
