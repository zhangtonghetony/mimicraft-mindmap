# Security and data boundaries

Mimicraft Mindmap is an early-stage client-side application. It has automated tests, but has not undergone an independent security audit.

- Document processing, autosave and export run in the browser. The application does not provide a document-upload backend or analytics SDK.
- IndexedDB/localStorage are local plaintext storage. Other scripts on the same origin, browser extensions or people with access to the browser profile may be able to access that data.
- Password protection encrypts explicitly downloaded files with PBKDF2-SHA256 and AES-256-GCM; it does not encrypt IndexedDB, secure a compromised device or recover a forgotten password.
- Export packages can intentionally include a complete native .mimicraft snapshot and attachments. Review the selected scope and package contents before sharing. SVG output does not embed hidden notes or other canvases as raw metadata.
- Local paths are stored as text; the application does not silently open arbitrary disk locations. Media permissions must be granted by the user.

For a suspected vulnerability, use the repository's **Security → Advisories → Report a vulnerability** if available. Otherwise contact the maintainer through their GitHub profile with a non-sensitive initial description; do not post exploitable secrets or private documents in public Issues.

General rendering/compatibility bugs without sensitive information can be filed as ordinary Issues.
