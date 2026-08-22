# DAVEX-ULTRA

> A multi-device WhatsApp automation bot focused on fast command handling, group administration, media tools, games, automation, and API-powered utilities.

## Overview

DAVEX-ULTRA is a Node.js bot built around a persistent WhatsApp multi-device session. It provides a broad command system for private chats and groups, with configurable access modes, owner controls, group administration, media processing, status tools, and entertainment features.

The project is designed to run from a standard Node.js process or a supported container and platform deployment. Runtime credentials and session data must be supplied through the host environment and must never be committed to the repository.

## Capabilities

| Area | Included functionality |
|---|---|
| WhatsApp | Multi-device session handling, pairing support, message routing, reactions, presence, and status utilities |
| Groups | Administration, moderation, protection controls, member tools, welcome and goodbye automation |
| Media | Stickers, text-to-sticker, animated text, audio effects, text-to-speech, image and video utilities |
| Downloads | Music, video, social-media, document, and link tools with provider fallbacks |
| AI and APIs | AI chat, image tools, anime utilities, lyrics, sports, search, and other API-backed commands |
| Automation | Auto-read, auto-react, auto-typing, auto-recording, chatbot modes, and scheduled-style bot behaviors |
| Owner controls | Runtime settings, privacy options, anti-delete and anti-edit scopes, command access, and diagnostics |

## Requirements

- Node.js 18 or newer.
- A WhatsApp account for the bot session.
- Network access to WhatsApp and any API providers used by enabled commands.
- A writable runtime directory for the SQLite database and session state.

## Installation

```bash
git clone https://github.com/Davex-254/DAVE-X-ULTRA.git
cd DAVE-X-ULTRA
npm install
npm start
```

For development, run the entry point directly:

```bash
node index.js
```

## Configuration

Create the required environment configuration on the host or platform secret manager. Do not upload `.env`, authentication databases, SQLite files, logs, or other runtime state to GitHub.

The bot uses the configured WhatsApp session when one is available. If no valid session is present, follow the pairing flow printed by the process. Keep the resulting authentication state private and back it up securely.

Common runtime settings include the bot prefix, operating mode, owner or sudo access, session configuration, and provider credentials. The exact variables used by a deployment should be supplied through its platform configuration rather than committed to source control.

## Commands

Commands use the configured prefix, which is `.` by default. Examples include:

```text
.menu
.ping
.tosgroup Hello from the group
.tourl
.sticker
.play song name
```

Use `.menu` in WhatsApp for the current command catalogue. Some commands are restricted to the owner, sudo users, or group administrators. Media commands can generally be used by sending a supported media message with the command as a caption or by replying to the media.

## Group status

The group-status command posts content to the WhatsApp group-status channel without echoing the status media into the ordinary group chat. Text, images, videos, audio, documents, and supported stickers can be supplied directly or through a quoted message.

```text
.tosgroup Group announcement
```

The command also accepts the maintained group-status aliases registered in the command catalogue. Use `.menu` to view the active aliases.

## Deployment

The repository includes the existing deployment manifests used by the project. Configure secrets and runtime variables in the selected platform dashboard, then deploy the repository using that platform’s normal Node.js or container workflow.

Before deploying, verify that the platform provides:

1. A persistent or recoverable session-storage strategy.
2. A supported Node.js runtime.
3. A writable directory for runtime state.
4. Environment-variable configuration for secrets.
5. Automatic restart handling for process failures.

## Security and maintenance

Never publish WhatsApp authentication state, pairing information, access tokens, private API keys, database files, or platform credentials. Rotate any credential that has been exposed and remove it from repository history where necessary.

Keep the process logs private. When diagnosing a problem, share only redacted errors and never include session identifiers, private phone numbers, tokens, cookies, or database contents.

## Project structure

| Path | Purpose |
|---|---|
| `index.js` | Application entry point and connection lifecycle |
| `main.js` | Message routing, command dispatch, access checks, and runtime handlers |
| `plugins/` | Command implementations grouped by feature area |
| `lib/` | Shared context, database, session, media, status, and utility modules |
| `package.json` | Runtime scripts and dependency declarations |
| `app.json`, `Dockerfile`, `heroku.yml` | Deployment configuration supplied with the project |

## Support the project

If DAVEX-ULTRA is useful to you, consider starring the repository, reporting reproducible issues with redacted logs, and contributing improvements that respect WhatsApp’s terms and user privacy.

## License

Use and redistribute this project responsibly. Review the repository history and deployment configuration before creating a public fork.

Copyright © 2026 Dave Tech.
