# ReadMeGen
 ## Badges  
[![Latest release](https://img.shields.io/github/v/release/deawar/readMeGen?style=plastic)](https://github.com/deawar/readMeGen/releases/latest)[![Downloads](https://img.shields.io/github/downloads/deawar/readMeGen/total?style=plastic)](https://github.com/deawar/readMeGen/releases)[![GitHub issues](https://img.shields.io/github/issues/deawar/ReadMeGen?style=plastic)](undefined/network)[![GitHub forks](https://img.shields.io/github/forks/deawar/ReadMeGen?style=plastic)](undefined/network)[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-v2.0%20adopted-ff69b4.svg?style=plastic)](code_of_conduct.md) 
## Description  
  As a developer I wanted an easier way to create a readme.md file for my projects. It runs from the CLI **or** as a desktop (Electron) app.

## Download  
Prebuilt desktop installers (current release **v1.0.0**) — direct links below, or
browse **every version** on the [Releases page](https://github.com/deawar/readMeGen/releases/latest).

| Platform | Download |
|----------|----------|
| **Windows** — installer | [readMeGen-Setup-1.0.0.exe](https://github.com/deawar/readMeGen/releases/download/v1.0.0/readMeGen-Setup-1.0.0.exe) |
| **Windows** — portable | [readMeGen-1.0.0.exe](https://github.com/deawar/readMeGen/releases/download/v1.0.0/readMeGen-1.0.0.exe) |
| **macOS** — Intel + Apple Silicon (universal) | [readMeGen-1.0.0-universal.dmg](https://github.com/deawar/readMeGen/releases/download/v1.0.0/readMeGen-1.0.0-universal.dmg) |
| **Linux** — Debian / Ubuntu (`.deb`) | [readmegen_1.0.0_amd64.deb](https://github.com/deawar/readMeGen/releases/download/v1.0.0/readmegen_1.0.0_amd64.deb) |
| **Linux** — any distro (AppImage) | [readMeGen-1.0.0.AppImage](https://github.com/deawar/readMeGen/releases/download/v1.0.0/readMeGen-1.0.0.AppImage) |

> Builds are currently **unsigned**, so you may see a one-time Gatekeeper (macOS)
> or SmartScreen (Windows) prompt on first launch. On Ubuntu, the AppImage needs
> `libfuse2` (`libfuse2t64` on 24.04); `.deb` installs with
> `sudo apt install ./readmegen_1.0.0_amd64.deb`.
* [Installation](#installation)  
* [Configuration](#configuration)  
* [Usage](#usage)
* [Testing](#testing)  
* [License](#license)  
* [Contributing](#contributing)  
* [Dependencies](#dependencies)
* [Dev Dependeies](#dev-dependencies)  
* [Questions](#questions) 
  
## Installation  
``` 
npm install 
``` 
## Configuration
**GitHub Personal Access Token.** ReadMeGen uses the GitHub API to look up your profile (name, avatar, email) and
to validate any contributors you list. **It works without any setup** — but
unauthenticated requests are capped at **60 per hour**, and GitHub will not share
your email address.

Adding a free Personal Access Token raises the limit to **5,000 requests per
hour** and lets the app read your public email for the Contact/Questions section.
The token is **optional but strongly recommended**.

### 1. Create a token
1. Sign in to GitHub and open **Settings → Developer settings → Personal access tokens → Tokens (classic)**.
2. Click **Generate new token → Generate new token (classic)**.
3. Name it something like `readMeGen`.
4. ReadMeGen only reads your public profile, so you need minimal scopes:
   * **`read:user`** — read your name, avatar, and bio
   * **`user:email`** — read your email address
   * No `repo` scope is required.
5. Click **Generate token** and **copy it immediately** — GitHub shows it only once.

### 2. Add it to a `.env` file
Create a file named `.env` in the project root:

```
TOKEN=ghp_your_token_here
```

The app loads it automatically on startup via [dotenv](https://www.npmjs.com/package/dotenv).

> ⚠️ **Keep it secret.** `.env` is already listed in `.gitignore`, so your token
> won't be committed. Never paste a real token into code, issues, or screenshots.
> If a token is ever exposed, revoke it under GitHub → Developer settings.

## Usage  
``` 
node index.js 
``` 
## Testing
```
npm test
```  
## License  
[MIT](https://github.com/deawar/ReadMeAgain/blob/master/LICENSE) -A license with no conditions whatsoever which dedicates works to the public domain. Unlicensed works, modifications, and larger works may be distributed under different terms and without source code.
  
## Contrubuting Guidelines 
 This Repo proudly follows the [Contributor Covenant](https://www.contributor-covenant.org/) which is an industry standard. 
 
## Dependencies  
*  ["axios": "^0.27.2"](https://www.npmjs.com/package/axios)
*  ["chalk": "^5.0.1"](https://www.npmjs.com/package/chalk)
*  ["dotenv": "^16.0.1"](https://www.npmjs.com/package/dotenv)
*  ["figlet": "^1.5.2"](https://www.npmjs.com/package/figlet)
*  ["inquirer": "^9.0.0"](https://www.npmjs.com/package/inquirer)
*  ["open": "^8.4.0"](https://www.npmjs.com/package/open)

## Dev-Dependencies
*  ["standard": "^17.0.0"](https://www.npmjs.com/package/standard)

## Questions 
![Dean Warren](https://avatars3.githubusercontent.com/u/15312495?v=4&s=48)  Email: [Dean Warren](mailto:deawar@gmail.com) or  click on [@Dean Warren](https://github.com/deawar)
