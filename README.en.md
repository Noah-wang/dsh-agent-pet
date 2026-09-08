# DSH Agent Pet

DSH Agent Pet adds a small draggable companion to the lower-right corner of the DeepSeek Harness Web UI. Momo reacts to agent thinking, tool execution, pending approval, completion, and failure states.

## Install from a local checkout

Run from the DeepSeek Harness checkout:

```bash
pnpm dsh plugin --profile web add /absolute/path/to/dsh-agent-pet
pnpm dsh web
```

## Install from GitHub

```bash
dsh plugin --profile web add github:Noah-wang/dsh-agent-pet
```

## Uninstall

```bash
dsh plugin --profile web remove dsh-agent-pet
```

Restart the Web UI after changing the installed plugin set.

## Pet Studio

Hover the pet and click 🎨 to open the studio. Enter a name, a visual description (8–800 characters), and a style preset, then press "开始绘制" to generate a transparent **eight-pose sprite sheet** that replaces the current pet. "恢复默认" restores the packaged Momo.

### One pose per state

A single generation draws the same pet in eight poses on a 4×2 grid, in this order: `idle`, `thinking`, `running_tool`, `waiting_approval`, `done`, `error`, `resting`, `greeting`. Generating eight separate images would yield eight different animals; one generation keeps the character consistent. The UI picks the matching cell with CSS `background-position` and never decodes the image. The last two poses have no trigger yet and are reserved.

### Generate in another AI (no API key needed)

Expand "用别的 AI 生成": fill in a name and description, press "生成提示词", copy the self-contained prompt into any image AI, ask it for a transparent 4×2 sprite sheet PNG, then press "导入精灵表 PNG" to bring it back. Adjust the column/row inputs if that AI lays the poses out differently; 1×1 imports a single frame. The image dimensions must divide evenly by the grid. This path costs nothing and needs no credential.

Generation needs an image API key. The host resolves `OPENAI_API_KEY` through the DSH credential service; the studio says so and sends nothing when the key is missing. `apiKeyEnv`, `model` (default `gpt-image-2`), `baseURL`, `quality`, and `dataDir` are configurable. Style presets: `auto`, `pixel`, `sticker`, `plush`, `flat-vector`, `3d-toy`.

Generation runs only on an explicit click, may incur provider charges, and is limited to one request at a time (`409` otherwise). Only a valid bounded PNG is stored, writes are atomic, and the key never reaches browser state, responses, or stored metadata.

## Privacy and permissions

The plugin reads agent lifecycle events and tool names only. It does not retain conversation messages, tool arguments, tool results, credentials, or browsing data. The client performs same-origin requests to the local DSH host and loads only the local avatar. Generation requests carry only the name, description, and style you type in the studio.

See [SECURITY.md](SECURITY.md) before adding executable community extensions.
