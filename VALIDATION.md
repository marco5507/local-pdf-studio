# Validation — Local PDF Studio 1.1.0

Build prepared on 11 September 2026. This is a personal-installation release candidate; the installed-extension checks below are still required before calling every acceptance criterion complete.

## Passed

- TypeScript validation and production bundle generation.
- Twenty-six automated tests covering native editable annotations; Traditional/Simplified Chinese appearances; standard forms; mutually exclusive radio buttons after merging; encrypted drafts and exports; signed-document read-only handling; stamps, ink, shapes and markup; crop, rotation, reorder, duplicate, merge, extraction and undo; routing-rule construction; and split ZIP output.
- Browser integration using compiled production assets: rendering and selectable text, pointer-driven annotation creation, undo/redo, Chinese notes, form editing, watermark preview/application, page duplication, both PDF exports, real IndexedDB checkpoint/reopening, language switching, and theme switching. The runner uses synthetic DOM events; it is not a physical stylus test or an installed-extension routing test.
- Independent Poppler rendering of the editable export confirmed Chinese annotation text and the filled Chinese field with its border. PDFium rendering and text inspection confirmed flattened comment-summary pages. Acrobat Reader has not been tested.
- Python's ZIP reader verified split archive entries and CRC checks independently.
- A simulated IndexedDB denial in the compiled browser test left the PDF usable, displayed **Save failed**, and still produced a valid emergency export.
- The user-supplied Drive PDF was opened through the signed-in browser and downloaded locally for engine testing. All three pages rendered; 7,212 text characters were extracted; editable and flattened copies reopened successfully. This validates that PDF, not the installed Drive handoff.

## Initial performance measurements

These are single-run local MuPDF/WASM measurements in Node, not full-browser responsiveness or memory benchmarks.

| Fixture | Open | First-page render | Checkpoint |
|---|---:|---:|---:|
| 200 text pages, 180 KB | 112 ms | 96 ms | 30 ms |
| 18 image-heavy pages, 58.7 MB | 154 ms | 262 ms | 164 ms |

The viewer runs document operations in a dedicated worker, limits rendered pixel count, and renders visible/nearby pages. Longer printing operations show page progress; other operations currently show an indeterminate working indicator.

## Remaining live acceptance checks

1. After reloading version 1.1.0 in current stable Google Chrome, verify the supplied Drive link and Drive folder double-click create exactly one separate PDF Studio tab while the Drive page stays intact. Reopen the same file with edits present and confirm the existing viewer is focused. Test explicitly selected Drive accounts. The new tab behavior is covered by mocked Chrome/content-script tests; installed-extension behavior still requires a live retest.
2. Test actual Chrome response-header routing for ordinary and extensionless PDF URLs, explicit attachment downloads, exclusions, unsupported embedded viewers, and allowed/denied file URL access. Automated tests validate rule construction, not Chrome's execution of those rules.
3. Open both exported versions in Acrobat Reader and inspect forms, custom appearances, comments and supported annotation editing.
4. Test forced tab closure and browser restart after **Saved locally**, physical stylus pressure and erasing, real printing, and full-browser memory/scroll behavior with the large fixtures.
5. Disable networking after opening a local PDF and verify the complete edit/export workflow. Production processing assets are bundled locally and there is no upload or telemetry implementation; an independent network-capture audit has not been performed.

## Compatibility limits

Drive download restrictions, authentication pages, private blob URLs, POST-generated documents, and unrecognized embedded viewers keep a download/open fallback. The bridge does not register a Google Workspace “Open with” app or bypass access controls.

Custom PDF appearance streams and unusually complex forms/annotation relationships need additional compatibility testing. Unsupported annotations are preserved when editing the same document but do not receive editing controls. Reopening a recovered draft restores its PDF state and reading position; it starts a new undo history. Visual signatures are stamps, not certificate signatures.

## Reproduce

Run `npm ci`, `npm test`, and `npm run build` with Node 24+. Start `npm run dev`, then visit `/qa.html` for source browser checks. For compiled checks, run `node scripts/qa-build.mjs` and visit `/qa-built.html`. The browser report is written under `test-artifacts/`. `scripts/check-local-pdf.ts` accepts a local test PDF path. Optional Python rendering and large fixtures use `scripts/pdf-qa.py`; engine timing uses `tests/performance.ts`.

The supplied private Drive document is excluded from the delivered source and extension packages.

## Installed Drive test — 9 September

The installed 1.0.0 content script detected the supplied Drive PDF automatically, but the handoff remained at its waiting status. Version 1.0.1 replaces cross-window readiness messages with a validated extension-runtime relay and displays the editor when its application starts. Relay validation is covered by an automated test. A user reload and live retest remain necessary; successful installed Drive opening is not yet claimed. Browser automation policy prevents directly inspecting extension pages or operating Chrome extension-management controls.

## Continuous eraser — 1.0.2

Replaced per-click deletion with a captured pointer gesture, full swept-path hit testing, a screen-sized circular cursor, and live document-preserving previews. All strokes crossed during a drag commit in one undoable operation. Automated browser checks cover pointer-move events with button=-1, crossing two strokes in one fast movement, preserving an untouched stroke and a rectangle, cancellation, and whole-gesture undo. All 14 engine/integration tests passed.

After reloading 1.0.1, the user confirmed their Drive PDF pages and editing toolbar were visible without reselecting a file. Direct automation inspection of extension content remains restricted.

## Two eraser modes — 1.0.3

Added bilingual Partial/Full mode selection. Partial mode clips ink polylines against the full swept circular eraser path and keeps all surviving segments in the editable native ink annotation. Full mode retains whole-stroke deletion. Both preview without modifying the working PDF, commit one undoable gesture, and support cancellation. Tests cover sparse/diagonal segments, point erasing, complete removal, export/reopen and undo/redo. All 16 automated engine/integration tests passed.
The compiled browser integration suite also passed, including selecting Partial, retaining a split stroke, switching to Full, removing the remainder, and undoing both operations.

## Laser pointer — 1.0.4

Added a temporary red pointer and fading trail in both Read and Annotate, with English/Traditional Chinese labels. The overlay handles pointer events independently and has no document-engine edit path. Animation stops after the trail fades and is cleaned up on tool changes, zoom changes, window blur, or tab hiding.
The compiled browser suite passed: laser dot and trail appeared, the trail faded, changing tools removed the overlay, and no annotation or undo operation was created.


## Highlight and underline deletion — 1.0.5

Both eraser modes now remove touched native highlights, underlines and strikeouts in the same undoable gesture as pen edits. Partial mode still trims pen strokes. Markup hit testing follows individual quadrilaterals, preventing removal solely from crossing an empty gap between lines. The engine exposes markup quads for selection, previews removals without modifying the draft, and preserves locked annotations.

Selecting an annotation explicitly moves keyboard focus from the properties editor to its hit button. Selection also responds to button activation. Thin markup has a minimum screen hit height, and the selected annotation has an adjacent delete button. Delete and Backspace remove the selected annotation while typing in property/form fields remains protected.

All 18 automated engine/integration tests passed, including mixed partial ink/text-markup removal, native markup preview, export/reopen, individual deletion, and undo/redo. The compiled browser suite passed all 18 stages with no errors: selecting highlights/underlines after focusing the properties textbox, Delete/Backspace, the adjacent delete button, both eraser modes, unrelated-annotation preservation, and whole-gesture undo. A separate browser mouse/keyboard check created a text highlight, selected it after clicking the text editor, visually verified the adjacent delete button, and confirmed Delete removed it. These checks ran against compiled assets on localhost; the installed extension still needs reloading.


## Separate Google Drive editor tab — 1.0.6

Removed the Drive overlay/iframe and its readiness relay. The content script only observes file identities and sends requests without inserting UI, preventing clicks, or changing Drive navigation. A single background handler serializes requests from the folder and preview, reuses the same file/account/profile viewer without navigating it, remembers loading viewer tabs in session storage, and discovers existing extension tab contexts after worker or browser restarts. Closed or repurposed tabs are not reused. The existing Open original bypass also suppresses Drive handoff, preventing fallback loops.

Seven new automated tests execute the real tab handler with mocked Chrome APIs and the unmodified content script in a minimal Drive DOM. They cover concurrent duplicate events, unchanged source tabs, loading tabs, worker restart, context discovery, closed and repurposed tabs, account/profile separation, resource keys, exclusions, denied access/storage, creation failures, repeated mutations, and navigation to another PDF. All 24 document/integration tests pass. The compiled standalone browser test also passed: automatic source loading without file selection, account/resource-key propagation through the local download stub, page rendering and text selection, local draft checkpoint, and clearing Drive identity on Home. The complete compiled editing browser suite passed all 18 stages with no errors. Drive downloads in this new browser test use the synthetic local fixture; live Chrome tab APIs are mocked only in the Node tests.

The implementation uses Chrome's documented [extension context discovery](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-getContexts) and [session storage](https://developer.chrome.com/docs/extensions/reference/api/storage). No additional extension permissions are requested. Browser automation cannot manage or inspect installed extension pages here, so the new installed Drive behavior is not claimed as live-verified.


## Six everyday improvements — 1.1.0

Implemented in sequence: transactional draft conflict protection; remembered eraser diameter; selected-text annotation toolbar with note entry; guarded tool shortcuts; draft-local named bookmarks attached to stable page IDs; and a compiled running-version badge with local update detection and save-before-refresh.

Draft tokens are compared and updated in the same IndexedDB transaction across the draft and summary stores. Database version 3 retains existing records while rejecting older version-2 clients. Stale writers cannot replace another draft, even when a document was deleted in another tab. Conflicting work can be exported or forked to a new draft ID. Bookmarks participate in the same checkpoint and conflict protection; bookmark-only changes also count as unsaved work.

All 26 Node document/integration/geometry/shortcut checks passed. The new compiled browser suite passed all eight stages: bookmark CRUD/reorder/undo/recovery; eraser cursor sizing and remembered preferences; typing-safe shortcuts; selected-text highlights and composed notes; version mismatch detection without automatic reload; actual IndexedDB race rejection and older-client rejection; and conflict export/separate-draft preservation. The existing 18-stage compiled browser regression suite also passed, including editable/flattened export, forms, Chinese text, local recovery and denied storage. A browser mouse selection and screenshot confirmed the new toolbar appears beside selected text, and the bookmark panel remains readable. Installed-extension reload behavior and physical stylus use still require user-side checks; local browser fixtures do not claim those results.


## Backup, annotation filters and study notes — 1.2.0

All 29 Node tests passed. New checks cover binary backup round trips, bookmark/preferences preservation, corrupted/truncated/trailing-data rejection, signature MIME validation, color/type intersection, safe HTML escaping, and non-mutating filtered renders. Study extraction was checked after crop, rotation, reorder and editable export/reopen, including Chinese note contents.

The compiled browser upgrade suite passed five stages with no errors: combined filters and reset; study preview/filter/download; preservation of all annotations in PDF export; backup of active edits, damaged-file rejection, additive restore and preserved stable bookmark identity; and reopening the restored draft. The existing 18-stage editing regression suite also passed with no errors, including erasers, markup deletion, laser, Chinese annotations, forms, editable/flattened exports, local recovery and denied storage. Screenshots confirmed readable controls and English/Chinese study preview content. Browser fixtures use synthetic PDFs on localhost and real IndexedDB; no personal documents are uploaded.

The extension package and source are saved locally. Installed extension activation and real Google Drive handoff have not been retested in this release; they require extension reload and refreshed tabs. These results do not claim Acrobat, full-browser restart, physical stylus, or large-library backup performance testing.


## Text-box editing and transparent movement — 1.2.1

Reproduced the missing typing focus and Ctrl+S exporting the placeholder while edited text remained in the focused field. Text boxes now provide an on-page textarea, double-click editing, a separate Move handle, controlled pending text, and flushing before autosave, export, print, history and editing operations. Minimum placement height avoids an unreadable first line; overflow is reported without discarding the full contents.

FreeText text color is taken from its default appearance, rather than using the annotation color that PDF viewers interpret as a background. New text boxes have no background color; editing/moving older Local PDF Studio boxes clears their erroneous background. Modification metadata is set before generating the custom appearance to avoid regenerating it afterward.

All 30 Node checks passed, including transparent pixel checks after move and repair of a legacy colored box, multiline Chinese text, resizing, font/color changes, rotation, undo/redo, and editable/flattened export/reopen. The dedicated compiled browser suite passed six stages: direct typing focus, focused Ctrl+S, autosave without blur/focus loss, clipping warning and resize, move, double-click editing, undo/redo and reopening. Manual browser interactions and screenshots additionally confirmed on-page English/Chinese typing and transparent movement. Installed extension activation still requires the user's reload; this test used synthetic local documents.

The full existing 18-stage compiled browser regression suite also passed on 1.2.1 with no errors, including erasers, forms, comments, flattening and denied storage.


## Text font selection — 1.2.2

All 32 Node checks passed. New engine tests verify 12 distinct rendered Latin font styles, editable export/reopen, preservation through later text edits and movement, font undo/redo, and pixel-equivalent flattened output. Font aliases and optional font presets also round-trip through backup validation.

The compiled font browser suite passed four stages without errors: selecting a font before placement and checking the inline editor style; changing an existing font with pending English/Chinese typing and checking the exported PDF; undo/redo; and remembering the font for the next box. The existing six-stage text-box browser suite also passed without errors, including focused Ctrl+S, autosave, resizing, movement, double-click editing and export/reopen. A screenshot confirmed the readable font selector and rendered Courier Bold text. These checks used synthetic PDFs in Chrome on localhost; installed-extension activation requires reload. Acrobat verification is not claimed.


## Stable zoom and editable file replacement — 1.2.3

Zoom captures the current page-relative reading point before layout changes and restores scroll offsets in a layout effect. Browser scroll anchoring is disabled in the document container; scroll-driven page selection is suppressed during zoom layout. Normal scrolling identifies the page containing the reading line instead of the nearest page top, preserving the selected side of a two-page row.

The compiled Chrome zoom suite passed five stages on a synthetic ten-page document with mixed portrait/landscape sizes: zoom buttons, percentage selection and Fit width in Continuous, Single page and Two pages; rapid repeated zoom; and last-page visibility at minimum zoom. Position assertions allow natural scroll limits when the whole page fits. No browser errors were reported.

All 36 Node tests passed. Four new file-save tests verify editable annotations and form values after overwrite/reopen, cancellation and export failure before writing, external modification detected during export, and abort on write failure. The compiled file-save browser suite passed two stages: pending text is flushed and saved with native editable annotations/form fields, and picker cancellation leaves the document intact. The browser test substitutes a picker returning a real origin-private file handle, so it exercises Chrome file writes without replacing personal files. The installed extension's native destination picker and OS replacement confirmation remain manual checks.

Save-to-original uses the local File System Access API and does not update Google Drive or website source documents. No additional extension permissions were added. Source: https://developer.chrome.com/docs/capabilities/web-apis/file-system-access

The existing compiled browser regression suite also passed all 18 stages with no errors on 1.2.3, covering annotations, erasers, forms, page organization, editable/flattened export, draft recovery, bilingual UI and denied storage.
