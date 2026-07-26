# Chald Launcher

Custom Minecraft launcher built for our server — powered by Electron, with an automatic system for downloading and updating our modpack build.

[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Discord](https://img.shields.io/discord/000000000000000000?label=Discord&logo=discord&color=5865F2)](https://discord.gg/2WU7YcMgZX)

## Features

- 🔄 Automatic download and update of the server's mod build
- 🎮 Launch Minecraft with a preconfigured modpack (NeoForge)
- 🔑 Microsoft/Azure authentication
- 💬 Discord integration
- 🖥️ Windows support (Linux build in progress)

## About

This launcher was built specifically for a private Minecraft server. The UI and part of the base architecture are based on [X Minecraft Launcher (XMCL)](https://github.com/Voxelum/x-minecraft-launcher), licensed under MIT — most of the logic has been rewritten and adapted for our server's needs.

The public APIs used (Microsoft/Azure authentication, Discord RPC) come from the original launcher and are open integrations provided by the respective platforms.

## Tech Stack

- Electron
- TypeScript
- Node.js

## Community

Join our Discord: [discord.gg/2WU7YcMgZX](https://discord.gg/2WU7YcMgZX)

## Installation

Download the latest version from the [Releases](../../releases) section.

## License

Part of the code is based on [XMCL](https://github.com/Voxelum/x-minecraft-launcher), licensed under MIT. The original license text is included in the `LICENSE` file.
