# Afterlight

## Tagline

Find the film you left behind.

## Category

Resurrection

## Inspiration

A roll of film used to become a contact sheet. Every exposure was visible together, including the awkward frames and the moments the photographer had forgotten. That physical overview made choosing a story possible.

Digital footage often disappears into folders with hundreds of similar filenames. Afterlight revives the contact sheet and paper edit for that material. It is built for the moment before a heavy editing session, when you want to see what you have and decide what is worth keeping.

## What it does

Drop in video files and Afterlight builds contact sheets locally in your browser. Click a frame to seek to its source time. Label and star clips, leave editorial notes, and mark in/out ranges. Arrange those selections in a paper edit and play them in order to review the shape of the story.

The result can leave the app as a printable HTML contact sheet, a JPEG sheet, an ordered CSV source cut list, a Markdown outline, or a JSON backup. Original video stays on your device. Saved thumbnails and notes remain available after refresh, and the source can be relinked when you need playback again.

## How we built it

Kiro CLI helped turn the concept into a concrete product by reviewing failure cases and implementing the first version of the browser media module. That module uses decoded video frames, source seeking and canvas rendering. Astra/Codex integrated and reviewed the module and developed the interface, storage model and paper-edit workflow.

The root .kiro directory contains requirements, design, tasks and steering. The original Kiro output is included. The implementation uses standard browser APIs with no runtime package dependencies.

## Challenges

Local media tools need to explain what persists. Afterlight saves thumbnails and editing decisions, then asks the user to relink the source video after a reload. It validates restored project data and protects against stale writes from another tab. Partial import failures preserve the work already on the light table. Contact sheets retain portrait and landscape aspect ratios.

## Accomplishments

The experience carries a real workflow from video import to a usable editing reference. The photographic visual language comes from film borders, contact frames and source timestamps. Every primary action serves the task of finding and organizing footage.

## What is next

Future work could add tested native NLE interchange and scene-based sampling. The current implementation uses uniform sampling and exports source cut references. It documents these boundaries explicitly.

## Demonstration plan, under three minutes

0–20 seconds — Explain the forgotten-footage problem and the analog contact-sheet idea.

20–50 seconds — Open the sample collection and show actual decoding of three MP4 clips. Open a source and click a contact frame to seek.

50–90 seconds — Add a note, select an in/out range, and add it to the paper edit. Add a second selection from another clip.

90–120 seconds — Reorder the two selections, undo, and preview the sequence.

120–145 seconds — Show exported CSV and an offline contact sheet. Reload and demonstrate a saved project plus explicit source relinking.

145–165 seconds — Show the .kiro specification, original Kiro implementation response and final media module. State the current supported formats and local processing behavior.
