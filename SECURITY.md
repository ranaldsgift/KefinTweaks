# Security Policy

This security policy applies to [ranaldsgift/KefinTweaks](https://github.com/ranaldsgift/KefinTweaks).

## Supported Versions

Security and bug fixes are provided for the **latest stable release only**. Security fixes are prioritized and will typically trigger an out-of-cycle release.

| Version | Supported |
|---------|-----------|
| Latest stable | ✅ |
| Older releases | ❌ |

## About KefinTweaks & Security Scope

KefinTweaks is a **client-side JavaScript plugin** that runs in the browser via the JS Injector plugin. Unlike server-side Jellyfin plugins, it executes entirely within the Jellyfin Web UI context. This means its attack surface is different from typical plugins.

**In-scope vulnerabilities:**

- Cross-site scripting (XSS) introduced by KefinTweaks scripts
- Insecure handling of user-supplied input (search queries, config values, imported JSON)
- Unintended exfiltration of Jellyfin API tokens or user data via injected scripts
- Malicious content injection via the CDN delivery path (`cdn.jsdelivr.net`)
- Watchlist or config import accepting malformed/malicious JSON in a dangerous way
- localStorage/IndexedDB data being accessible or manipulated in unintended ways

**Out of scope:**

- Vulnerabilities in **Jellyfin core** → report to the [Jellyfin project](https://github.com/jellyfin/jellyfin/security)
- Vulnerabilities in **JS Injector** → report to [n00bcodr/Jellyfin-JavaScript-Injector](https://github.com/n00bcodr/Jellyfin-JavaScript-Injector)
- Vulnerabilities in **Custom Tabs** or **File Transformation** plugins → report to [IAmParadox27](https://github.com/IAmParadox27)
- Issues arising from a user self-hosting scripts with a misconfigured web server

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

### Preferred Method

Use the **"Report a vulnerability"** button under the **Security** tab of this repository. This opens a private, encrypted channel directly with the maintainer.

### What to Include

A useful report should contain:

- A clear description of the vulnerability and its potential impact
- Steps to reproduce, including:
  - Jellyfin server version
  - KefinTweaks version
  - Browser and OS
  - Whether you are using CDN delivery or self-hosting the scripts
- Any relevant console output, screenshots, or proof-of-concept code
- Your suggested severity (low / medium / high / critical)

### Response Timeline

| Stage | Target |
|-------|--------|
| Acknowledgement | Within 72 hours |
| Initial assessment | Within 7 business days |
| Fix or mitigation | Depends on severity |

## Disclosure Policy

KefinTweaks follows **coordinated disclosure**. Once a fix is released, a summary will be published in the release notes. Reporters will be credited by name or handle upon request.
