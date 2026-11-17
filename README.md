# Afterlight

**Find the film you left behind.**

A contact sheet for forgotten digital footage. Afterlight revives the analog photographic contact sheet and the paper edit in a browser. It helps filmmakers see the material they have, pick useful moments, and carry those decisions into their next editing session.

Built during Kiroween 2026 for the **Resurrection** category. Kiro CLI generated the first implementation of the media-processing module and reviewed the product design. Astra/Codex implemented and integrated the application and reviewed the resulting code.

Live demo: https://afterlight-contact-sheets.major-gnome-1485.chatgpt.site/

Public source: https://github.com/User20244ming/afterlight

## Open the workspace

Install Node.js 20 or later and run `npm start` in this folder. Open `http://127.0.0.1:4175`. The app has no install or build dependencies. Any static host can serve `dist/` over HTTP or HTTPS.

Choose **Open sample collection** for three playable sample clips, or **Import footage** to use your own files. The samples are generated imagery with animated camera motion and are labeled in the interface. The exact same extraction pipeline handles samples and user videos.

## Workflow

1. Import video files. The browser extracts 12 evenly spaced, decoded frames for each source. The app displays up to six on the library card and all twelve in the source viewer.
2. Open a clip and click a frame to seek. Add notes, label the clip, and star material worth returning to.
3. Set in/out points in seconds, or mark the playhead with **I** and **O** when focus is outside a text field. Add a selection note and add the range to your paper edit.
4. Reorder selections with the up/down buttons, remove selections, or undo the latest changes. Preview plays selected source ranges in order.
5. Export a printable, self-contained HTML contact sheet, a JPEG sheet for an individual clip, an ordered CSV cut list, a Markdown paper edit, or a JSON project backup.

Exports contain source-relative time values. Milliseconds are display precision. The app does not know original camera timecode, source frame-rate metadata, edit frame rate, or drop-frame conventions. Sequence preview uses browser playback and can pause between source files. It is an approximate review of the paper edit. CSV and Markdown are editing references. They are not native Premiere/Resolve timelines or rendered video.

## Storage and privacy

Imported videos stay as local File/Blob references in memory. They are not uploaded. IndexedDB stores thumbnails, names, metadata, notes, and selections. The source video must be selected again after closing or reloading. Contact sheets and notes remain visible until the user clears browser storage or the browser evicts it. Export a backup to preserve the project outside that browser.

Normal reimport matches filename, size, and modification time, then verifies duration and dimensions. The explicit **Relink original file** control also supports a matching original whose modification time changed, with an in-app confirmation. Relinking uses metadata, not byte-level identity. A file that was renamed must be restored to its original filename before relinking.

IndexedDB updates compare a saved revision within the write transaction. Another tab's newer revision stops stale writes. A BroadcastChannel also shows a conflict message early. Reload the stale tab after exporting any local copy you want to keep.

The static host receives ordinary page and bundled-asset requests. Fonts and demo videos are bundled. The app contains no analytics, credentials, tracking SDKs, remote AI inference calls, or user-media upload endpoint. HTML and JSON exports include thumbnails and notes, so share them with the audience you intend.

## Boundaries

- Up to 60 clips, 500 selected ranges, and 2 GB per source file.
- Browser codec support applies. H.264 MP4 is included in the demo. Some MOV/MKV files require conversion to a browser-supported codec.
- Video frames are uniformly sampled. There is no automatic scene recognition or semantic search.
- Each source file is processed sequentially, with decode timeouts and cancellation. Failed files produce a message and leave earlier successful imports intact.
- Thumbnail dimensions are capped at 480 × 480 and retain source aspect ratio.
- JSON restore checks version, types, identifiers, ranges, embedded image formats, and size limits before replacing a project.
- Undo covers the latest 20 in-memory changes and resets on reload.

See `docs/VERIFICATION.md` for executed checks and current limitations. The 2 GB and 60-clip maximums are configured bounds, not measured performance guarantees on every device.

## Sources and development

Source modules are in `dist/`. `media.js` contains the reviewed Kiro-generated extraction and contact-sheet export implementation. `model.js` owns canonical data validation and text exports. `storage.js` owns version-checked IndexedDB writes. `app.js` owns UI state and the normal user flows.

The `.kiro` folder contains the actual project requirements, design, steering and task records. `docs/KIRO_USAGE.md` describes the real calls and revisions. `docs/ASSETS.md` records imagery, fonts and licenses. `docs/ENTRY.md` provides the English competition description and demo plan.

Code is MIT licensed. Bundled fonts carry their own SIL Open Font License files.
