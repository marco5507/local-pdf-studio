# Local PDF Studio

A personal, local-only Chrome PDF editor with English and Traditional Chinese menus. Licensed under AGPL-3.0-or-later.

## Install

1. Keep the supplied **extension** folder somewhere permanent on your computer.
2. Open `chrome://extensions` in Google Chrome.
3. Turn on **Developer mode**, select **Load unpacked**, and choose the **extension** folder containing `manifest.json`.
4. The setup page opens. Choose **Open supported PDFs automatically**, then approve Chrome's website-access request.
5. Refresh any Google Drive tabs that were already open when you installed the extension.
6. Optional: in the extension's Chrome details, enable **Allow access to file URLs** to take over PDFs opened directly from disk. The file picker and drag-and-drop work without this setting.

For a source build, run the commands below and load the generated **dist** folder instead.

## Opening a PDF

- Open a normal PDF link: supported top-level PDF responses open directly in the editor.
- Open a PDF in Google Drive: PDF Studio opens the document automatically in **one separate extension tab**. The original Drive tab keeps its normal page or preview. Reopening the same file focuses its existing PDF Studio tab without reloading your edits. You do **not** select the file again. Different files or explicitly selected Drive accounts use separate document tabs.
- Right-click a PDF link and choose **Open in Local PDF Studio** for a manual handoff.
- Click the extension icon for the home screen and local drafts.

Automatic opening requires the one-time site-access grant. Excluded domains keep their usual viewer. Explicit attachment downloads remain downloads. Drive's custom interface, its cookies, multiple signed-in accounts, and file download permissions affect the Drive bridge. The tab handoff does not bypass access controls, download restrictions, virus-scan interstitials, or sign-in pages. If it cannot retrieve a PDF, it leaves the original Drive preview available. Website-embedded viewers, private blob URLs, POST-generated PDFs, and PDFs whose identity is not exposed by the host viewer may require opening the original download link.

## Tools

- **Read:** temporary laser pointer, selectable text, search, outline, zoom, continuous/single/two-page views, reading mode, and print.
- **Annotate:** highlight, underline, strikeout, notes, text boxes, shapes, arrows, pen, and stroke eraser. Select Eraser, then choose **Partial eraser** or **Full eraser** in the mode selector. Partial trims the touched section of pen strokes, leaving the remaining stroke editable; Full removes the entire touched pen stroke. Both modes remove touched highlights, underlines, and strikeouts as complete annotations. Use **Eraser size** to choose a remembered 4–80 px diameter. Hold the left mouse button and drag; release to commit the gesture. One Undo restores the entire drag. Select text for markup, or drag a region on a scanned page. Draw to add an object. Choose **Select** and click an annotation to select or move it; drag its corner handle to resize. Press **Delete** or **Backspace**, or click the **×** beside the selection, to delete it.
- **Forms & Sign:** fill supported standard PDF fields; draw, type, or upload a visual signature. Reusable signatures are stored only if you check **Remember this signature**.
- **Organize:** select thumbnails, drag to reorder, move up/down, rotate, duplicate, delete, insert blank pages, merge, extract, and split. Split ranges use semicolons, such as `1-3; 4-6`. Split PDFs are delivered together in one ZIP to avoid repeated browser download prompts.
- **Finish:** crop pages, insert images, add watermarks, and add page numbers. Batch dialogs preview the selected appearance and accept ranges such as `1, 3-5`.

Properties apply to the selected annotation, or to the next annotation when nothing is selected. Text changes save after two seconds of inactivity and commit before PDF export or printing; numeric property changes commit when you leave the field. Form fields commit when you leave the field or press Enter. Undo/redo works during the current session; reopening a draft restores the edited PDF, not its undo history.

### Saving

**Save a copy** downloads a PDF with editable supported annotations and form fields. The arrow beside it offers **Save flattened copy**, which makes those additions static and appends a summary of note/comment contents. The working draft stays editable. Other viewers may offer different editing controls for stamps or custom appearances.

The original file stays unchanged unless you choose **Save to original file…** and select it in the local save dialog. This option preserves editable annotations and form fields; it does not update Google Drive or website originals. Crop changes alter the crop box; they do not remove hidden content. Visual signatures are not certificate-based digital signatures. This extension does not offer secure redaction or original-text replacement.

### Drafts and privacy

The extension saves a recoverable local copy after two seconds of inactivity. If another tab saved a newer version, this tab stops overwriting that draft and offers **Save separate draft** or **Export PDF**. A separate draft keeps this tab’s edits and bookmarks without changing the other saved version. Check **Saved locally** before closing. On a save error, export a PDF before leaving. Drafts remain in this browser profile until you delete them or remove the extension/clear its storage. They are not cloud backups.

All document processing happens on your device. Network requests are limited to obtaining a PDF you open and following links you click. No telemetry, upload service, analytics, account, or remote fonts are included. Password-protected drafts remain encrypted; passwords stay in memory and are requested again after reopening. Signed PDFs and documents with restrictive editing permissions are read-only.

## Build from source

Use Node.js 24 or newer:

```text
npm ci
npm run build
npm test
```

Load **dist** through Chrome's **Load unpacked**. The source archive includes generated icons. MuPDF includes its fallback CJK fonts in the bundled local runtime; annotation appearance streams embed the glyphs needed for display.

For development, `npm run dev` serves the workspace at `http://127.0.0.1:5173`. The local browser integration runner is available at `/qa.html` after `npm test` creates its synthetic sample. It uses only synthetic test documents and a local report endpoint. The production bundle excludes the runner and report endpoint. For testing compiled assets, run `node scripts/qa-build.mjs` after the build and visit `/qa-built.html` on the development server. `/qa-drive-built.html` tests automatic startup from a Drive URL using a synthetic local PDF and a stubbed download, without contacting Google Drive.

## Project structure

- `src/engine.ts`: MuPDF document operations; `pdf.worker.ts` and `client.ts`: worker protocol and startup handshake.
- `src/App.tsx`, `PageCanvas.tsx`, `SignatureDialog.tsx`: workspace, page interactions, and signatures.
- `src/storage.ts`: transactional IndexedDB drafts and a lightweight recent-document index.
- `public/background.js`, `rules.js`, `drive.js`, `drive-tabs.js`: Chrome routing, Drive detection, and duplicate-safe viewer tab creation.
- `tests/`: document round trips, compatibility, routing, and browser integration tests.
- `scripts/`: package licenses, prepare browser QA, generate icons, and optional independent PDF/performance checks.

No API keys, Google OAuth client, or server deployment are required. The Drive handoff is a browser integration with the existing Drive session; it is not a registered Google Workspace “Open with” application.

## Validation and limitations

See **VALIDATION.md** for automated checks and remaining manual checks. This release targets current desktop Chrome, with a minimum of Chrome 128 for response-header routing. It is packaged for personal unpacked installation, not published to the Chrome Web Store.

## License

AGPL-3.0-or-later. See **LICENSE** and **THIRD-PARTY-NOTICES.md**. The complete corresponding extension source accompanies the build. MuPDF is from Artifex; React and React DOM are from Meta and contributors; Lucide icons are from Lucide contributors. This project is not affiliated with Adobe, Google, Smallpdf, or those component authors.

### Laser pointer

Choose **Laser pointer** in Read or Annotate. Move over a page for the red pointer dot; hold the left mouse button and drag for a bright trail that fades after about 0.85 seconds. Press Escape or choose Select to exit. It is a presentation overlay and creates no PDF annotations, draft edits or printed/exported marks. It can also be used with read-only PDFs.


### Updating an existing installation

Wait for **Saved locally** in each document, reload Local PDF Studio on Chrome's Extensions page, and refresh the Google Drive tabs that were already open. Version 1.0.6 replaces the previous in-page overlay with a separate editor tab. Existing PDF Studio tabs are never automatically closed or reloaded by the duplicate check.


## Everyday tools — 1.1.0

- **Selected text toolbar:** choose Select, select PDF text, then use the nearby highlight, underline, strikeout, color, or note controls. Notes have a small text box before you add them. Escape dismisses the toolbar. Existing scanned-page markup tools remain available.
- **Shortcuts:** V = Select, H = Highlight, P = Pen, E = Eraser, L = Laser. These do not activate while typing, composing Chinese text, using a dialog, holding modifier keys, or processing an edit. Read-only documents allow Select and Laser only. Shortcuts are also listed in Settings and tooltips.
- **Bookmarks:** open the Bookmarks panel, enter a name, and choose Add bookmark for the current page. Rename directly in the list, jump with the page button, or remove with ×. Bookmarks follow stable page identities through reorder and undo. If a bookmarked page is deleted, its entry is marked unavailable until that page is restored. Bookmarks belong to the local draft; they are not embedded into exported PDFs.
- **Version notice:** the top bar shows the version running in this tab. A newer local extension manifest triggers a notice on focus or the periodic local check. Save and refresh tab saves first and does not proceed if saving fails or a draft conflict is unresolved. No document is automatically refreshed.

Before updating from 1.0.x, wait for Saved locally in all open PDF tabs, reload the extension, and refresh those tabs. The draft database upgrades to version 3 to prevent older unguarded clients from overwriting protected drafts. Existing drafts are retained. Older tabs may report a storage error until refreshed; export any remaining edits before refreshing a tab that has not saved.

The `/qa-improvements-built.html` local test runner checks all six additions, including concurrent IndexedDB writes, using synthetic data. Run `node scripts/qa-build.mjs` after building to generate it. OCR remains outside this release.


## Backup and study tools — 1.2.0

- **Home or Settings → Backup and restore:** Download a `.lpsbackup` file containing all saved drafts, original and edited PDF bytes, reading positions, bookmarks, appearance settings, pen presets, and locally remembered signatures. The current tab is checkpointed first; wait for **Saved locally** in other PDF tabs before making a backup. Passwords and undo history are not included. The container adds no encryption; protected PDF bytes retain their PDF encryption.
- Choose a backup file to validate it and preview its drafts. **Restore copies** adds drafts with fresh identities in one storage transaction and never replaces existing drafts. Open restored copies from Home. Appearance/pen settings and saved signatures are optional; website access and automatic opening remain configured on the destination browser. Keep the backup if storage runs out, then retry after freeing space.
- **Properties panel → Annotation filters:** Filter by annotation type and color. Filters affect document pages, thumbnails, annotation selection/erasing, and the comments list. Hidden annotations stay in the PDF. An active-filter banner offers **Show all annotations**, including when side panels are hidden. PDF exports and print include every annotation.
- **Properties panel → Export study notes:** Select a page range, optionally use the current annotation filters, preview the marked text and comments, and download a printable HTML document. Page numbers refer to the current PDF order. English and Chinese text are retained where usable text exists. Markups on scanned pages are listed without extracted text; OCR is not included. The HTML opens locally in a browser and can be printed or saved as PDF using the browser print dialog.

To activate an update, wait for **Saved locally** in open PDF tabs, click **Reload** on Local PDF Studio in Chrome's extensions page, and refresh PDF Studio and Drive tabs. The version badge should show **1.2.4**.


## Text-box fixes — 1.2.1

Create a text box and type directly inside it. Double-click an existing text box to edit its contents. Click outside, press Escape, or use Ctrl+Enter to finish editing. Drag the **Move** handle above the selected box to reposition it; drag the corner handle to resize. When not editing, dragging inside the box also moves it. The background stays transparent. Existing Local PDF Studio boxes with the old color-fill problem are corrected when edited or moved.

Text changes save locally while typing, and Ctrl+S includes the latest text even while the cursor remains inside the box. English, Chinese and line breaks are supported. A short placement drag creates a readable minimum box; the Properties panel warns when additional lines do not fit, so you can enlarge it or reduce the font size.


## Text fonts — 1.2.2

Select a text box, then choose **Properties → Font**. Helvetica, Times and Courier each offer regular, bold, italic and bold italic styles. You can also choose a font before placing a new text box. The choice is remembered for the next box and included in appearance settings backups. Font changes preserve the text you are typing and support undo/redo.

Fonts work locally and are retained in editable and flattened PDF copies. Chinese characters continue to use the bundled Chinese font; the Latin font styles do not change Chinese glyphs. Custom font uploads are not included.


## Stable zoom and editable file replacement — 1.2.3

Zoom in/out, the percentage menu, and Fit width keep the reading position on the current page. Continuous mode tracks the page containing the reading line; two-page mode retains the selected page within its row. At the start/end of the document or when a whole page fits, scrolling is limited by the available space.

Open the arrow beside **Save a copy → Save to original file…**, select the original PDF on your computer, and confirm replacement in the file dialog. This exports an editable PDF with annotations and form fields intact, without flattening. Choose the destination each time; automatic draft saving continues to use local browser storage. Ctrl+S continues to download an editable copy.

The extension cannot replace Google Drive or website originals with this option. It writes only to the local file you choose. Read-only PDFs do not allow replacement. Cancelling the picker leaves the document open. Export completes before the selected file is opened for writing; failures are reported and the draft remains available.


## Browser tab filename and logo — 1.2.4

Each PDF tab shows the open document’s filename beside the app logo. Names remain intact, including Chinese characters and punctuation; the browser may shorten long titles visually. Returning Home shows Local PDF Studio. Opening another file or restoring a draft updates the title after the document opens successfully.
