# Security policy

## Supported versions

Security fixes are released in the [latest stable version](https://github.com/DejavuMoe/Ecoku/releases/latest). Older versions do not receive separate security backports.

This policy covers the Ecoku server, browser SDK, admin interface, and the build and release tooling in this repository.

## Report a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/DejavuMoe/Ecoku/security/advisories/new) to send a report to the maintainers. Please do not disclose an unresolved vulnerability in a public issue or pull request.

Include:

- The affected release or commit and component.
- The required configuration, permissions, and other preconditions.
- A minimal reproduction using synthetic data, with expected and actual behavior.
- The security impact and any suggested mitigation.

Remove credentials, tokens, visitor email addresses, and other personal information from logs and attachments. Test only on systems you own or have permission to test; do not probe other people's Ecoku instances or the documentation demo.

The maintainers will use the private report to discuss reproduction, impact, fixes, and disclosure. Please coordinate public disclosure through that report so users can receive a fix or mitigation first.

For ordinary bugs, installation questions, and feature requests, use [GitHub Issues](https://github.com/DejavuMoe/Ecoku/issues).
