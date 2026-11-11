# Inkwell

Inkwell is a desktop app for writing and organizing Markdown manuscripts. It works with local files and offers a customizable writing environment, draft recovery, version history, and export to other formats. It is built with Electron, React, and Tiptap and is free software licensed under GPL-3.0-only.

[![Build and release](https://github.com/matigeringer/inkwell/actions/workflows/build.yml/badge.svg)](https://github.com/matigeringer/inkwell/actions/workflows/build.yml)

## Download

Downloads are available on [GitHub Releases](https://github.com/matigeringer/inkwell/releases). These links point to the files from the latest published release.

| Platform              | Download                                                                                                                        | Use                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Linux x86-64          | [inkwell-linux-x86_64.AppImage](https://github.com/matigeringer/inkwell/releases/latest/download/inkwell-linux-x86_64.AppImage) | Run without installation                 |
| Debian / Ubuntu amd64 | [inkwell-linux-amd64.deb](https://github.com/matigeringer/inkwell/releases/latest/download/inkwell-linux-amd64.deb)             | Install with desktop integration         |
| Windows 10 / 11 x64   | [inkwell-windows-x64.exe](https://github.com/matigeringer/inkwell/releases/latest/download/inkwell-windows-x64.exe)             | Portable executable without installation |

The links become available once the first successful workflow run for a `vX.Y.Z` tag publishes a release. Until then, follow the instructions for building from source. The binaries are attached to releases and kept out of Git.

The downloads run without Node.js or npm. Packages are available for 64-bit Intel and AMD systems only. Linux requires a graphical session and the desktop libraries Electron depends on. Verify compatibility with each Linux distribution before listing it as supported.

### Linux AppImage

Download the file, open a terminal in the download directory, and run the following commands. Adjust the filename if it includes a version number.

```bash
chmod +x inkwell-linux-x86_64.AppImage
./inkwell-linux-x86_64.AppImage
```

If the system reports that FUSE is missing, install your distribution's FUSE 2 package (`libfuse2` or `libfuse2t64` on Debian and Ubuntu, depending on the version). You can also extract and run the app without FUSE.

```bash
./inkwell-linux-x86_64.AppImage --appimage-extract
./squashfs-root/AppRun
```

Electron's sandbox remains enabled and requires user namespaces or a correctly installed sandbox helper. On Ubuntu, if AppArmor blocks the AppImage, use the `.deb` package, which includes the system integration. Keep the sandbox enabled and run the app as a regular user.

### Debian / Ubuntu .deb package

Run this command from the download directory. Adjust the filename if it includes a version number.

```bash
sudo apt install ./inkwell-linux-amd64.deb
```

Open **Inkwell** from the application menu or by running `inkwell`. To uninstall it, run `sudo apt remove inkwell`.

### Windows

Download `inkwell-windows-x64.exe`, save it in its own folder, and double-click it. It runs without installation or administrator permissions. You can create a shortcut manually. The executable extracts its components to a temporary folder at startup. Preferences, drafts, and version history persist in `%APPDATA%\inkwell` between runs. To remove the app, delete the `.exe`. Local data stays on the device.

The executable is **unsigned**, so Windows may display an “Unknown publisher” or SmartScreen warning. Verify the source and SHA-256 checksum before opening it. Release validation includes launching the app and testing write operations on a Windows machine.

### Verify a download

Download the checksum manifest for [Linux](https://github.com/matigeringer/inkwell/releases/latest/download/SHA256SUMS-linux.txt) or [Windows](https://github.com/matigeringer/inkwell/releases/latest/download/SHA256SUMS-windows.txt) **from the same release** as the executable. The release manifests use filenames without version numbers. Keep those names for automatic verification. Locally built packages include the version in their filenames and have their own manifests.

On Linux, place both packages and the manifest in the same directory and run the following command.

```bash
sha256sum --check SHA256SUMS-linux.txt
```

If you downloaded only one package, run `sha256sum filename` and compare the result with its entry in the manifest. The full check reports the other package as missing.

In PowerShell, substitute the name of the downloaded file and compare the reported `Hash` with the manifest.

```powershell
Get-FileHash .\inkwell-windows-x64.exe -Algorithm SHA256
```

## Features

- Open Markdown folders and files, create documents, and browse manuscripts.
- Write in a visual editor or use source mode to preserve tables, images, and HTML.
- Use Zen mode and customize themes and typography.
- Use the device's primary language by default. Inkwell uses Spanish for any Spanish variant and English for all other languages. You can also choose either language in Preferences.
- Recover local drafts, browse version history, and compare changes.
- Export to PDF, DOCX, ODT, Markdown, and plain text.

Manuscripts are saved wherever you choose. Preferences, drafts, and version history are stored in `~/.config/inkwell` on Linux (or `$XDG_CONFIG_HOME/inkwell`) and `%APPDATA%\inkwell` on Windows. These files stay on the device after uninstalling. Drafts and version history are **unencrypted** and cannot replace an external backup. Documents are limited to 10 MiB. For details on saving, recovery, conflicts, and export limits, see the [technical guide](electron-app/README.md).

## Development

You need [Node.js](https://nodejs.org/) 22.12.0 or later and npm. Running the app also requires a graphical environment compatible with Electron.

```bash
git clone https://github.com/matigeringer/inkwell.git
cd inkwell/electron-app
npm ci
npm run dev
```

`npm ci` downloads Electron and installs the dependencies pinned in the lockfile. Run these commands from `electron-app/`.

```bash
npm run check          # warning-free linting, tests, and build
npm run test:electron  # native Electron test on Linux with a temporary profile
npm run test:packaged  # same test against the ASAR produced by build:linux
npm run build:unpack   # unpacked application for inspection
npm run build:linux    # AppImage, deb, and SHA256SUMS-linux.txt (x64)
npm run build:win      # portable executable and SHA256SUMS-windows.txt (x64)
```

Packages are written to `electron-app/dist/`. Build Linux packages on Linux. You can build the portable Windows executable on Windows or Linux with the electron-builder tools pinned in the lockfile. GitHub Actions builds Linux packages on Ubuntu and Windows packages on a Windows runner, both using Node 22. Publishing uses the automatic GitHub Actions token. Local build commands never publish files.

To reproduce the packages on a machine with Docker, run the following command from the repository root.

```bash
docker run --rm -v "$PWD:/project" -w /project/electron-app electronuserland/builder:22-wine /bin/bash -lc 'npm ci && npm run build:linux && npm run build:win'
```

The container can create root-owned files. Use a dedicated working copy for this command to keep `node_modules` separate from the host's copy.

## Publish a release

The [release guide](docs/RELEASING.md) covers GitHub Actions requirements, package validation, optional signing, and how to build an additional NSIS installer on Windows. The workflow runs checks and builds Linux and Windows packages when changes are pushed to `main` or a version tag is pushed, keeping those artifacts for 14 days. Only stable `vX.Y.Z` tags publish permanent packages and create a release with the download links from this README.

For the first release, review, commit, and push the changes to `main`, then validate the packages before tagging.

```bash
git tag -a v1.0.0 -m "Inkwell 1.0.0"
git push origin v1.0.0
```

The tag must match the `version` in `electron-app/package.json` and its lockfile. The `release` job verifies all files and checksums before attaching the files to GitHub Releases. Publish a new version to correct an existing release. Release notes are in [CHANGELOG.md](CHANGELOG.md).

## Contribute and get help

Open a [GitHub issue](https://github.com/matigeringer/inkwell/issues) with the app version, your operating system, and steps to reproduce the problem. To contribute, create a branch, make your changes, run `npm run check` from `electron-app/`, and open a pull request. Keep personal manuscripts, sensitive data, dependencies, and generated files out of the pull request.

## License

[GNU General Public License, version 3](LICENSE) (GPL-3.0-only). Each package includes the license. The corresponding source code is available under the release tag.
