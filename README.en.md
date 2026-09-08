# DSH Agent Pet

DSH Agent Pet adds a small draggable companion to the lower-right corner of the DeepSeek Harness Web UI. Momo reacts to agent thinking, tool execution, pending approval, completion, and failure states.

## Install from a local checkout

Run from the DeepSeek Harness checkout:

```bash
pnpm dsh plugin --profile web add /absolute/path/to/dsh-agent-pet
pnpm dsh web
```

## Install after publication

Once a Git repository is selected and published:

```bash
dsh plugin --profile web add github:OWNER/dsh-agent-pet
```

Do not copy the placeholder command verbatim. Replace `OWNER` with the verified repository owner.

## Uninstall

```bash
dsh plugin --profile web remove dsh-agent-pet
```

Restart the Web UI after changing the installed plugin set.

## Pet Studio

Hover the pet and click 🎨 to open the studio. Enter a name, a visual description (8–800 characters), and a style preset, then press "开始绘制" to generate a transparent PNG avatar that replaces the current pet. "恢复默认" restores the packaged Momo.

Generation needs an image API key. The host resolves `OPENAI_API_KEY` through the DSH credential service; the studio says so and sends nothing when the key is missing. `apiKeyEnv`, `model` (default `gpt-image-2`), `baseURL`, `quality`, and `dataDir` are configurable. Style presets: `auto`, `pixel`, `sticker`, `plush`, `flat-vector`, `3d-toy`.

Generation runs only on an explicit click, may incur provider charges, and is limited to one request at a time (`409` otherwise). Only a valid bounded PNG is stored, writes are atomic, and the key never reaches browser state, responses, or stored metadata.

## Privacy and permissions

The plugin reads agent lifecycle events and tool names only. It does not retain conversation messages, tool arguments, tool results, credentials, or browsing data. The client performs same-origin requests to the local DSH host and loads only the local avatar. Generation requests carry only the name, description, and style you type in the studio.

See [SECURITY.md](SECURITY.md) before adding executable community extensions.
