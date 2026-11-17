# Afterlight requirements

Build a local video contact-sheet workspace for filmmakers returning to forgotten footage. Kiroween 2026 category Resurrection, reviving the analog contact sheet and paper edit.

1. Import multiple browser-decodable videos, inspect metadata and extract evenly spaced frames locally. Clearly identify sampling, not semantic AI scene detection.
2. A failed or canceled import leaves existing clips usable. Duplicate source files relink using filename, size, lastModified and duration checks.
3. Browse contact sheets, filter and search by filename, label and note. View frames with source timestamps and play from that position.
4. Select an in/out range, add an editorial note and a color label. Add ranges to an ordered paper edit and rearrange or remove them.
5. Export a source-time CSV, Markdown paper edit, self-contained HTML contact sheet and JSON project backup. Exports must handle hostile text as inert data and avoid spreadsheet formula execution.
6. Save thumbnails, notes, metadata and paper-edit order in IndexedDB. Original user videos remain in memory and must be relinked after reload. Explain the relink state. Save atomically and display quota or persistence failures.
7. Provide a real playable bundled demo with generated imagery disclosed. Demo is independently importable, and uses the same extraction path as user files.
8. Keyboard access, visible focus, reduced motion, readable contrast and mobile layout are required.
9. No uploads, accounts, remote AI inference, API keys or trackers in the app. Assets and fonts are bundled for a self-contained static deployment.

Limits are explicit in the UI and README. A contact sheet is a navigation aid. Exported cut lists refer to source files and do not encode a finished video.
