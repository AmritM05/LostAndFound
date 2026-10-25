# Magpie application directory

The canonical project introduction, feature guide, architecture, verified status, Gemini privacy restrictions, configuration, and setup instructions are in the [repository-root README](../README.md).

This directory contains the Next.js application. Run package commands here, beside `package.json`; the Git repository root is one directory above.

## Start here

- [Getting started](../README.md#getting-started)
- [Database setup and migrations 001-008](../README.md#database-setup)
- [Configuration](../README.md#configuration) and [environment example](.env.example)
- [Testing and verification](../README.md#testing-and-verification)
- [Gemini implementation, consent limits and live-test status](memory/GEMINI_MATCHING.md)
- [Project memory and developer handoffs](memory/README.md)

After the root guide's environment/database setup, common commands from this directory are:

```sh
npm run dev
npm test
npm run typecheck
npm run build
```

No environment values or real credentials belong in Git. Optional Gemini processing remains restricted to explicitly confirmed synthetic demo data; the current demo authentication is not production campus identity verification.
