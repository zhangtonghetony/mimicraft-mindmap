# Mimicraft Mindmap contributor instructions

- Read README.md and plan.md before making changes; record material changes and validation in plan.md.
- This is an independent, free, browser-first mind-mapping application. Keep code, branding, demo content and screenshots independent; respect dependency licenses.
- Keep document processing local. Cloud storage, accounts, collaboration, analytics, proprietary format compatibility and paid tiers are outside the current scope.
- Application code is in app/, product documentation in guide/. The ignored docs/ directory is a local research archive and must not be published.
- Separate semantic document data, persisted canvas preferences and temporary UI state. Preserve legacy .mimicraft formats and validate input before applying it.
- Passwords stay in memory. Downloaded files may be encrypted; IndexedDB autosave is plaintext and the UI must say so.
- Implement changes against clear behavioral contracts, then run relevant unit/browser checks and pnpm --dir app build. Keep assertions meaningful; do not claim a check ran when it did not.
- GitHub Pages builds use PAGES_BASE_PATH. Keep localhost development working at / and test asset loading under the repository subpath before publishing.
- Never publish credentials, personal documents, account data, internal research materials, node_modules or test traces. Use synthetic demos for screenshots.
