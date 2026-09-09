# Changelog

All notable changes to this project are documented in this file.

## 0.5.0 - 2026-09-08

- The pet now actually animates. A generation produces a 6×8 frame-by-frame
  sheet — eight states, six frames each — instead of one static pose per state.
- Play the current state's row with CSS `steps()`, advancing
  `background-position-x` one cell per frame. Nothing decodes an image.
- Position cells in pixels rather than percentages; percentage offsets do not
  land on cell boundaries once frames advance.
- Drop the import divisibility check. The UI scales the sheet onto its own cell
  grid, so a 1024-wide sheet split into 6 frames is fine.
- Keep older pose grids and single-frame pets rendering unchanged; the layout
  records which kind it is.

## 0.4.0 - 2026-09-08

- Add a Pet section to Settings with the full studio and appearance controls,
  so generating a pet no longer requires discovering the hover-only 🎨 button.
- Persist position, hidden state, bubble, and animation preferences on the
  host. They previously lived in component state and were lost on every reload.
- Add `GET`/`POST /api/agent-pet/prefs` with validation, clamping, atomic
  writes, and a revision that lets the overlay ignore its own echo while
  dragging.
- Register the settings page through `slots.inject`, so a profile without the
  settings shell simply skips it.

## 0.3.0 - 2026-09-08

- Give every state its own pose: one generation now produces a 4×2 sprite sheet
  of eight poses instead of a single frozen image.
- Render the matching cell with CSS `background-position`, so no image decoding
  is needed on either side.
- Add prompt export: copy a self-contained sprite-sheet prompt and generate the
  pet in any other image AI. No API key and no provider charges.
- Add sprite-sheet import: bring back a PNG generated elsewhere, with an
  adjustable grid for AIs that lay out differently.
- Keep single-frame pets working; the packaged default and any earlier
  generated pet still render undistorted.

## 0.2.0 - 2026-09-08

- Add the AI Pet Studio: describe a pet, pick a style, and generate a
  transparent PNG avatar from the Web UI.
- Add authenticated host routes for generation status, avatar, generation, and
  restoring the packaged default.
- Resolve the image provider key through the DSH credential service; the key
  never reaches browser state or API responses.
- Store generated avatars atomically below the DSH data directory and reload
  them on restart.
- Accept OpenAI-compatible endpoints that return an image URL instead of inline
  base64; the host downloads it over HTTPS only, without redirects, and stores
  it only after PNG validation.

## 0.1.0 - 2026-09-08

- Add the Momo cloud-cat overlay to the DSH Web UI.
- React to agent, tool, approval, completion, and error states.
- Add draggable, hide, and restore interactions.
- Add declarative local `pet.md` configuration with safe asset validation.
- Add a local state API for development and hardware integration.
