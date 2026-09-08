# Changelog

All notable changes to this project are documented in this file.

## 0.2.0 - 2026-09-08

- Add the AI Pet Studio: describe a pet, pick a style, and generate a
  transparent PNG avatar from the Web UI.
- Add authenticated host routes for generation status, avatar, generation, and
  restoring the packaged default.
- Resolve the image provider key through the DSH credential service; the key
  never reaches browser state or API responses.
- Store generated avatars atomically below the DSH data directory and reload
  them on restart.

## 0.1.0 - 2026-09-08

- Add the Momo cloud-cat overlay to the DSH Web UI.
- React to agent, tool, approval, completion, and error states.
- Add draggable, hide, and restore interactions.
- Add declarative local `pet.md` configuration with safe asset validation.
- Add a local state API for development and hardware integration.
