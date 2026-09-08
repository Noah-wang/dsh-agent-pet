const MAX_PROMPT_LENGTH = 800
const MAX_NAME_LENGTH = 32
const MAX_RESPONSE_BYTES = 24 * 1024 * 1024
const MAX_IMAGE_BYTES = 12 * 1024 * 1024
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

export const PET_STYLES = Object.freeze([
  'auto',
  'pixel',
  'sticker',
  'plush',
  'flat-vector',
  '3d-toy',
])

const STYLE_PROMPTS = Object.freeze({
  auto: 'Choose a cohesive, charming desktop mascot style.',
  pixel: 'Crisp modern pixel-art mascot with a limited harmonious palette and clean silhouette.',
  sticker: 'Polished sticker mascot with a bold readable outline and compact rounded forms.',
  plush: 'Soft handmade plush mascot with simple tactile materials and a readable silhouette.',
  'flat-vector': 'Clean flat-vector mascot with rounded geometric shapes and restrained details.',
  '3d-toy': 'Small premium 3D toy mascot with soft studio materials and compact proportions.',
})

export class PetGenerationError extends Error {
  constructor(code, message, status = 500) {
    super(message)
    this.name = 'PetGenerationError'
    this.code = code
    this.status = status
  }
}

function cleanLine(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
}

export function parseGenerationRequest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: '请求格式不正确' }
  }
  const name = cleanLine(value.name)
  const description = cleanLine(value.description)
  const style = cleanLine(value.style) || 'auto'
  if (!name || name.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `宠物名字需要是 1–${MAX_NAME_LENGTH} 个字符` }
  }
  if (description.length < 8 || description.length > MAX_PROMPT_LENGTH) {
    return { ok: false, error: `外观描述需要是 8–${MAX_PROMPT_LENGTH} 个字符` }
  }
  if (!PET_STYLES.includes(style)) {
    return { ok: false, error: '不支持这个画风' }
  }
  return { ok: true, value: { name, description, style } }
}

export function buildPetPrompt({ name, description, style }) {
  return [
    `Create one original full-body desktop agent pet named ${JSON.stringify(name)}.`,
    `Character brief: ${description}`,
    STYLE_PROMPTS[style] || STYLE_PROMPTS.auto,
    'Single character only, centered, facing mostly forward, complete body visible, generous transparent padding.',
    'The silhouette and facial features must remain readable when displayed at about 108 by 96 pixels.',
    'Transparent background. No scenery, floor, shadow, glow, text, letters, UI, border, frame, symbols, or detached effects.',
    'Neutral friendly idle pose suitable for subtle breathing, bouncing, thinking, waiting, success, and error animations.',
  ].join('\n')
}

async function readBoundedText(response, maxBytes = MAX_RESPONSE_BYTES) {
  if (!response.body || typeof response.body.getReader !== 'function') {
    const text = await response.text()
    if (Buffer.byteLength(text) > maxBytes) throw new PetGenerationError('PROVIDER_RESPONSE_TOO_LARGE', '图片服务返回的数据过大', 502)
    return text
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let size = 0
  let text = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel()
      throw new PetGenerationError('PROVIDER_RESPONSE_TOO_LARGE', '图片服务返回的数据过大', 502)
    }
    text += decoder.decode(value, { stream: true })
  }
  return text + decoder.decode()
}

function providerMessage(payload, fallback) {
  const message = payload?.error?.message
  if (typeof message !== 'string' || !message.trim()) return fallback
  return message.trim().slice(0, 240)
}

export function decodePngBase64(value) {
  if (typeof value !== 'string' || !value || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    throw new PetGenerationError('INVALID_IMAGE_RESPONSE', '图片服务没有返回有效的 PNG', 502)
  }
  const estimatedBytes = Math.ceil(value.length * 3 / 4)
  if (estimatedBytes > MAX_IMAGE_BYTES) {
    throw new PetGenerationError('IMAGE_TOO_LARGE', '生成的图片超过 12 MB 限制', 502)
  }
  const bytes = Buffer.from(value, 'base64')
  if (bytes.length < 24 || !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new PetGenerationError('INVALID_IMAGE_RESPONSE', '图片服务没有返回有效的 PNG', 502)
  }
  return bytes
}

function combineSignals(signal, timeoutMs) {
  const timeout = AbortSignal.timeout(timeoutMs)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

export async function generateOpenAiPet({
  apiKey,
  prompt,
  model = 'gpt-image-2',
  baseURL = 'https://api.openai.com/v1',
  quality = 'medium',
  fetchImpl = globalThis.fetch,
  signal,
  timeoutMs = 180_000,
}) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new PetGenerationError('API_KEY_MISSING', '请先配置 OPENAI_API_KEY', 503)
  }
  if (typeof fetchImpl !== 'function') {
    throw new PetGenerationError('FETCH_UNAVAILABLE', '当前环境不能连接图片服务', 500)
  }
  let endpoint
  try {
    const root = new URL(baseURL.endsWith('/') ? baseURL : `${baseURL}/`)
    endpoint = new URL('images/generations', root)
  } catch {
    throw new PetGenerationError('INVALID_PROVIDER_URL', '图片服务地址无效', 500)
  }

  let response
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        'user-agent': 'dsh-agent-pet/0.2',
      },
      body: JSON.stringify({
        model,
        prompt,
        size: '1024x1024',
        quality,
        background: 'transparent',
      }),
      signal: combineSignals(signal, timeoutMs),
    })
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new PetGenerationError('PROVIDER_TIMEOUT', '图片生成超时，请稍后重试', 504)
    }
    throw new PetGenerationError('PROVIDER_UNREACHABLE', '无法连接图片服务', 502)
  }

  const text = await readBoundedText(response)
  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    throw new PetGenerationError('INVALID_PROVIDER_RESPONSE', '图片服务返回了无法识别的数据', 502)
  }
  if (!response.ok) {
    throw new PetGenerationError('PROVIDER_REJECTED', providerMessage(payload, '图片服务拒绝了这次生成'), response.status >= 400 && response.status < 600 ? response.status : 502)
  }
  return {
    bytes: decodePngBase64(payload?.data?.[0]?.b64_json),
    revisedPrompt: typeof payload?.data?.[0]?.revised_prompt === 'string'
      ? payload.data[0].revised_prompt.slice(0, 1000)
      : undefined,
  }
}

