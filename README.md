<p align="center">
  <img src="assets/echo-banner.svg" alt="ECHO AI — Ideas start here. Free, open-source AI chat website." width="100%" />
</p>

<h1 align="center">ECHO AI</h1>

<p align="center">
  <strong>Ideas start here.</strong><br/>
  A thoughtfully designed AI chat experience, available to everyone — no signup, no installation.
</p>

<p align="center">
  <a href="https://nittinchughani.github.io/echoai/"><img alt="Launch ECHO" src="https://img.shields.io/badge/LAUNCH_ECHO-8B5CF6?style=for-the-badge&logo=googlechrome&logoColor=white"/></a>
  <a href="https://github.com/NittinChughani/echoai"><img alt="Open source" src="https://img.shields.io/badge/OPEN_SOURCE-171923?style=for-the-badge&logo=github&logoColor=white"/></a>
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/LICENSE-MIT-16A085?style=for-the-badge"/></a>
</p>

<p align="center">
  <a href="https://nittinchughani.github.io/echoai/"><b>Try ECHO</b></a>
  &nbsp;·&nbsp;
  <a href="#features">Explore features</a>
  &nbsp;·&nbsp;
  <a href="#how-it-works">How it works</a>
  &nbsp;·&nbsp;
  <a href="#creator">Meet the creator</a>
</p>

---

## Built for the conversation, not the setup

ECHO is a **free, browser-based AI chatbot website** designed around a simple idea: great tools should be easy to access. Open a link, ask a question, brainstorm an idea, or work through a problem — all in a focused, responsive interface.

It's a real web project built with HTML, CSS, and vanilla JavaScript, hosted on GitHub Pages. Visitors don't need an account or a local installation.

### Features

| A focused chat experience | Tools that make it useful |
| :--- | :--- |
| **Instant access** — start chatting without signing up | **Conversation history** — revisit chats saved in your browser |
| **Six color themes** — choose Midnight, Pearl, Ocean, Forest, Ember, or Lavender | **Chat search** — locate earlier conversations |
| **Responsive layout** — use it on desktop or mobile | **Copy & regenerate** — make responses easier to reuse |
| **Streaming replies** — watch responses arrive as they are generated | **Custom instructions** — personalize response style |
| **Two explained AI modes** — learn when to use ECHO Quick vs ECHO Balanced | **Markdown export** — take a conversation with you |

## <a id="how-it-works"></a>How it works

ECHO keeps the interface lightweight and the setup straightforward:

1. **Open the [live website](https://nittinchughani.github.io/echoai/).** GitHub Pages serves the static frontend from the `docs/` folder.
2. **Send a message.** The browser sends the conversation to an external hosted AI endpoint.
3. **Read, explore, and continue.** Responses appear in the chat interface; conversation history is saved in your browser's local storage.

The default integration uses **OVHcloud AI Endpoints**. An optional Cloudflare Worker implementation is also included as a fallback for maintainers.

> [!NOTE]
> ECHO is free for visitors, but its third-party AI service has usage limits and may occasionally be unavailable. AI requests are processed by the external provider; don't send confidential information. Chat history is stored locally in your browser, not synced between devices.

## Technology

| Layer | Technology |
| :--- | :--- |
| Interface | HTML5, CSS3, vanilla JavaScript |
| Site hosting | GitHub Pages |
| AI inference | Third-party hosted language models via OVHcloud AI Endpoints |
| Optional fallback | Cloudflare Worker |
| Chat storage | Browser `localStorage` |

## Run your own copy

You don't need Node.js or a framework build process to explore the source.

1. Fork or clone this repository.
2. Open the `docs/` directory to explore the website's source files.
3. To publish a copy, enable **GitHub Pages → Deploy from a branch → `main` → `/docs`** in your fork's settings.

For AI configuration, see [`docs/config.js`](docs/config.js). The optional backend is in [`cloudflare/worker.js`](cloudflare/worker.js) with [setup notes](OPTIONAL_CLOUDFLARE_BACKUP.md).

<details>
<summary><b>Explore the project structure</b></summary>

~~~text
echoai/
├── docs/
│   ├── index.html         # Website
│   ├── styles.css         # Visual design and responsive styling
│   ├── app.js             # Chat interface and logic
│   ├── config.js          # AI provider configuration
│   └── favicon.svg        # Website icon
├── assets/
│   └── echo-banner.svg    # README artwork
├── cloudflare/
│   └── worker.js          # Optional fallback service
├── OPTIONAL_CLOUDFLARE_BACKUP.md
├── LICENSE
└── README.md
~~~

</details>

## Creator

**ECHO was created by [Nittin Chughani](https://github.com/NittinChughani)**, a Computer Science & Engineering student and digital creator from Pakistan.

ECHO is part of an ongoing effort to build useful, accessible open-source projects — tools that people can learn from and actually use.

**More from Nittin**

| Project | What it offers |
| :--- | :--- |
| **[CodeLab Academy](https://github.com/NittinChughani/codelab-academy)** | A free, interactive C/C++ learning website with lessons, challenges, quizzes, and a coding playground. [Try it live](https://nittinchughani.github.io/codelab-academy/). |
| **[C-CODE-BASIC-TO-ADVANCE](https://github.com/NittinChughani/C-CODE-BASIC-TO-ADVANCE)** | C programming practice and learning resources. |
| **[OOPS-IN-C-PLUS-PLUS](https://github.com/NittinChughani/OOPS-IN-C-PLUS-PLUS)** | Object-oriented programming work in C++. |

<p align="center">
  <a href="https://github.com/NittinChughani"><b>Explore Nittin's GitHub profile</b></a>
</p>

---

## Open source & contributions

ECHO is released under the [MIT License](LICENSE). Feel free to explore the implementation, fork the project, and suggest improvements through [GitHub Issues](https://github.com/NittinChughani/echoai/issues).

The **ECHO website** was created by Nittin Chughani. The underlying AI models and hosted inference are supplied by third parties; ECHO does not claim to have developed or trained those models.

<p align="center">
  <sub>Made to be useful, built to be shared.</sub>
</p>
