# Implementation design

`media.js` implements sequential browser video decoding, uniform source seeking, JPEG extraction and a three-column contact-sheet export. Kiro generated the initial module. Integration review tightened timeouts, failure reporting, cancellation and resource cleanup.

`model.js` validates the versioned project schema and generates safe CSV, Markdown and self-contained HTML exports. All restored images must be embedded JPEG data URLs. Text is rendered through textContent or HTML escaping. CSV cells that could begin spreadsheet formulas are prefixed with an apostrophe.

`storage.js` persists the project atomically in IndexedDB. It compares the caller's saved revision with the stored revision inside a readwrite transaction, aborting stale saves. The UI save queue serializes revisions and communicates conflicts.

`app.js` keeps source File/Blob references in memory, while metadata and contact images persist. Explicit relinking checks name, size, duration and dimensions and handles changed modification time with confirmation. The paper edit references clip IDs and source-relative ranges. Undo keeps 20 snapshots in memory. Preview plays source intervals sequentially with possible load gaps.

The interface bundles its fonts and sample media. The only app network calls are same-origin demo-asset retrieval. User footage is decoded through object URLs and never sent to a remote processor.
