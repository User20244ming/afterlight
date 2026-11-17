# Kiro in the development workflow

On November 15, 2026, Kiro CLI was invoked twice for this new project.

The product review call described the planned local media workflow and requested eight concrete failure cases and remedies. Its original output is preserved in `kiro-product-review.txt`. The implementation adopted sequence playback, undo and careful storage/relink behavior. Some proposed features were outside the implementation scope. Claims in the original review about codec memory behavior, browser privacy and market uniqueness were not treated as established facts.

The implementation call requested a standalone browser media module with `inspectVideo`, `extractFrame` and `makeContactSheet`. The successful original output is preserved in `kiro-media-original.txt`. Its implementation was reviewed and revised before integration. Changes include waiting for both completed seeking and a decoded frame, enforcing timeouts, handling cancellation and media errors, releasing object URLs, bounding portrait thumbnails, and restricting exported image sources to embedded image data.

Astra/Codex designed the contact-sheet interface, integrated the Kiro module, wrote project validation and persistence, implemented video range selection, paper-edit preview and exports, and ran browser interactions. A subsequent source review found and prompted fixes for stale-tab writes, filename truncation during restore, modified timestamps during relinking, invalid end-of-clip ranges, and sequence playback after completion.

The `.kiro` artifacts document the implemented specification and design. No Kiro hooks, MCP integrations or custom Kiro agents are claimed. The original generated responses are retained as development provenance and are not represented as verified descriptions of the final application.
