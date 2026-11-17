# Observed verification

Executed in the desktop in-app Chromium browser on November 15, 2026. These observations refer to the actual interface and downloaded artifacts. Mobile checks use a 390 × 844 browser viewport.

## Completed normal flows

- Loaded the three bundled MP4 files through the normal importer and obtained three clips with 36 decoded contact frames and 30 seconds of total footage.
- Reloaded and reopened the saved collection. Contact frames, clip notes, labels and paper-edit decisions survived.
- Opened a source clip, clicked the 2.083-second contact frame, marked that playhead as the in point, set an out point of 4 seconds, and added a note.
- Added a second selection from a different source, spanning 1–3 seconds. Preview advanced from clip one to clip two and displayed the sequence-complete message.
- Reordered selections and used Undo. The visible order returned to its previous state.
- Imported an independent 270 × 480 H.264 test video and a deliberately damaged MP4 in the same batch. The valid file became the fourth clip, with 12 portrait thumbnails. The damaged file did not create a clip.
- Added a Chinese clip note, reloaded, observed the source-relink panel, and selected the original file. Playback controls returned and the note remained.
- Attempted an invalid end-of-file selection with In 3 and Out 3.0005 on a 3-second source. The UI rejected it and preserved the existing two selections.
- Downloaded a 1800-pixel-wide contact-sheet JPEG for the portrait source and visually confirmed its distinct decoded frames and retained aspect ratio.
- Downloaded CSV, JSON and HTML exports through the UI. Read the CSV and JSON from disk. Source filenames, chosen ranges, note content, four clips and two selections matched the actual workspace.
- Attempted to restore a malformed JSON project referring to a missing clip. A validation message appeared and the current four-clip collection remained.
- Restored the valid exported JSON backup. The collection and paper-edit selections returned. Reorder and undo still worked.
- Opened a second tab and starred a clip. The original tab displayed “Another tab saved · reload to edit” and the stale-write warning.
- Inspected the 390 × 844 mobile layout and source viewer. Fixed the cover image overlapping explanatory text, then viewed the corrected layout.
- Exported the cinematic source's JPEG contact sheet as a user-facing example.
- Copied the independent portrait file to another directory so its modification time changed. The explicit relink flow verified matching name, size, duration and dimensions, requested confirmation, and restored source playback after confirmation.
- Inspected browser warning/error logs after the exercised flows. The returned log list was empty.

## Source-review fixes

Review addressed decode timeouts, media object cleanup, source filename preservation, timestamp-change relinking, canonical range validation, invalid image URLs in backups, formula-like CSV cells, HTML text escaping, sequence completion behavior, and revision checks inside IndexedDB write transactions.

## Verification boundaries

The large-file and maximum-clip limits were not stress-tested. Safari, Firefox, physical mobile devices, every codec, storage eviction, and quota exhaustion have no runtime verification in this delivery. A cross-tab notification was exercised, while exact simultaneous transaction races have source-level review. Cancel handling has source review.

The browser sequence viewer is an approximate review with source-loading gaps and browser playback timing. The exported numeric source ranges preserve the selected values. No native NLE import compatibility or rendered-video export is claimed.
