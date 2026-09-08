# Security

## Data access

DSH Agent Pet observes lifecycle events and tool names. It does not read or store conversation text, tool arguments, tool output, API keys, or credentials.

The browser half polls a same-origin local endpoint exposed by the DSH host. It makes no third-party network requests.

## Image generation

Generation is an explicit user action in the studio and may incur provider charges. Only the name, description, and style typed in the studio are sent to the configured image provider.

The API key is resolved by the DSH credential service inside the host process. It is never sent to the browser, written to pet metadata, or included in error messages; provider errors are reduced to bounded user-facing text.

Request bodies, prompts, provider responses, and image bytes are size-bounded. Only a response with a valid PNG signature is stored; generated SVG or HTML is rejected rather than executed.

Some OpenAI-compatible endpoints return an image URL instead of inline base64. In that case the host downloads the image itself, over HTTPS only, without following redirects, under a separate timeout and the same size bound, and stores it only if the bytes carry a PNG signature. No credential is sent with that download. Avatars and metadata are written atomically with restrictive permissions below the configured DSH data directory, and one generation runs at a time under a request timeout.

## Pet packages

`pet.md` is declarative. The parser accepts a small frontmatter subset and local relative avatar paths. It does not evaluate JavaScript, shell commands, HTML, prompts, or remote assets.

Review future functional plugins separately before installation. DSH plugins execute with the permissions of the local Harness process.

## Reporting

Report security issues privately through [GitHub Security Advisories](https://github.com/Noah-wang/dsh-agent-pet/security/advisories/new). Please do not open a public issue for a suspected vulnerability.
