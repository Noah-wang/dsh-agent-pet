import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { extname, isAbsolute, join, resolve } from 'node:path'
import { loadPetDefinition } from './pet-config.js'
import {
  buildPetPrompt,
  generateOpenAiPet,
  parseGenerationRequest,
  PetGenerationError,
  PET_STYLES,
} from './pet-generation.js'
import { loadStoredPet, resetStoredPet, saveStoredPet } from './pet-store.js'
import { createStateEvent, isPetState, normalizeObservation, PET_STATES } from './state.js'

export const inject = ['connection', 'credentials']

const MAX_REQUEST_BYTES = 4096

function jsonResponse(status, value) {
  return Response.json(value, {
    status,
    headers: {
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
    },
  })
}

async function readSmallJsonRequest(request) {
  const declared = Number(request.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) return undefined
  const text = await request.text()
  if (Buffer.byteLength(text) > MAX_REQUEST_BYTES) return undefined
  try {
    const value = JSON.parse(text)
    return value && typeof value === 'object' ? value : undefined
  } catch {
    return undefined
  }
}

function resultFailed(result) {
  return Boolean(result && typeof result === 'object' && (
    result.isError === true || result.error || result.status === 'error'
  ))
}

function defaultDataDir(config) {
  if (typeof config.dataDir === 'string' && config.dataDir.trim()) {
    return isAbsolute(config.dataDir) ? config.dataDir : resolve(config.dataDir)
  }
  const dshHome = typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME
    ? resolve(process.env.DSH_HOME)
    : join(homedir(), '.dsh')
  return join(dshHome, 'agent-pet')
}

function configuredString(value, fallback, maxLength = 200) {
  return typeof value === 'string' && value.trim() && value.length <= maxLength ? value.trim() : fallback
}

function activeFromStored(stored, fallback) {
  if (!stored) return { ...fallback, generated: false, revision: 'default' }
  const labels = Object.fromEntries(Object.entries(fallback.labels).map(([key, value]) => [
    key,
    value.replaceAll(fallback.name, stored.name),
  ]))
  return {
    id: stored.id,
    name: stored.name,
    version: stored.version,
    avatarPath: stored.avatarPath,
    labels,
    generated: true,
    revision: stored.revision,
    description: stored.description,
    style: stored.style,
  }
}

function publicPet(pet) {
  return {
    id: pet.id,
    name: pet.name,
    version: pet.version,
    generated: pet.generated,
    revision: pet.revision,
    ...(pet.description ? { description: pet.description } : {}),
    ...(pet.style ? { style: pet.style } : {}),
  }
}

function errorResponse(error) {
  if (error instanceof PetGenerationError) {
    return jsonResponse(error.status, { error: error.message, code: error.code })
  }
  return jsonResponse(500, { error: '生成宠物时遇到了问题', code: 'GENERATION_FAILED' })
}

export function apply(ctx, config = {}) {
  const loaded = loadPetDefinition(typeof config.petFile === 'string' ? config.petFile : undefined)
  if (!loaded.ok) throw new Error(`dsh-agent-pet: ${loaded.error}`)
  const fallbackPet = loaded.value
  const dataDir = defaultDataDir(config)
  const credentialRef = configuredString(config.apiKeyEnv, 'OPENAI_API_KEY', 64)
  const model = configuredString(config.model, 'gpt-image-2', 80)
  const baseURL = configuredString(config.baseURL, 'https://api.openai.com/v1', 500)
  const quality = ['low', 'medium', 'high'].includes(config.quality) ? config.quality : 'medium'
  const idleAfterMs = Number.isFinite(config.idleAfterMs) ? Math.max(600, config.idleAfterMs) : 2400
  let pet = activeFromStored(loadStoredPet(dataDir), fallbackPet)
  let state = createStateEvent('idle', { label: pet.labels.idle })
  let idleTimer
  let generationRunning = false

  function setState(next, details = {}) {
    const normalized = normalizeObservation(next, state.state)
    state = createStateEvent(normalized, {
      label: pet.labels[normalized],
      toolName: details.toolName,
    })
    if (idleTimer) clearTimeout(idleTimer)
    if (normalized === 'done' || normalized === 'error') {
      idleTimer = setTimeout(() => {
        state = createStateEvent('idle', { label: pet.labels.idle })
      }, idleAfterMs)
    }
  }

  async function generationInfo() {
    try {
      const info = await ctx.credentials.describe(credentialRef)
      return {
        available: Boolean(info?.configured),
        credentialRef,
        model,
        styles: PET_STYLES,
        busy: generationRunning,
      }
    } catch {
      return { available: false, credentialRef, model, styles: PET_STYLES, busy: generationRunning }
    }
  }

  async function statusRoute(request) {
    if (request.method === 'GET') {
      return jsonResponse(200, {
        pet: publicPet(pet),
        event: state,
        states: PET_STATES,
        generation: await generationInfo(),
      })
    }
    const body = await readSmallJsonRequest(request)
    if (!body || !isPetState(body.state)) {
      return jsonResponse(400, { error: 'state must be a supported pet state' })
    }
    setState({ kind: 'demo', state: body.state })
    return jsonResponse(200, { ok: true, event: state })
  }

  async function avatarRoute() {
    try {
      const bytes = await readFile(pet.avatarPath)
      const png = extname(pet.avatarPath).toLowerCase() === '.png'
      return new Response(bytes, {
        status: 200,
        headers: {
          'content-type': png ? 'image/png' : 'image/svg+xml; charset=utf-8',
          'cache-control': 'no-store',
          'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'",
          'x-content-type-options': 'nosniff',
        },
      })
    } catch {
      return jsonResponse(500, { error: '无法读取宠物图片' })
    }
  }

  async function generateRoute(request) {
    if (generationRunning) return jsonResponse(409, { error: '已有一只宠物正在生成', code: 'GENERATION_BUSY' })
    const body = await readSmallJsonRequest(request)
    const parsed = parseGenerationRequest(body)
    if (!parsed.ok) return jsonResponse(400, { error: parsed.error, code: 'INVALID_REQUEST' })
    const resolvedCredential = await ctx.credentials.resolve(credentialRef)
    if (!resolvedCredential?.value) {
      return jsonResponse(503, { error: `请先在 DSH 中配置 ${credentialRef}`, code: 'API_KEY_MISSING' })
    }

    generationRunning = true
    setState({ kind: 'agent-status', status: 'thinking' })
    try {
      const generated = await generateOpenAiPet({
        apiKey: resolvedCredential.value,
        prompt: buildPetPrompt(parsed.value),
        model,
        baseURL,
        quality,
        signal: request.signal,
      })
      const stored = await saveStoredPet(dataDir, { ...parsed.value, bytes: generated.bytes })
      pet = activeFromStored(stored, fallbackPet)
      setState({ kind: 'demo', state: 'done' })
      return jsonResponse(200, { ok: true, pet: publicPet(pet), event: state })
    } catch (error) {
      setState({ kind: 'demo', state: 'error' })
      return errorResponse(error)
    } finally {
      generationRunning = false
    }
  }

  async function resetRoute() {
    try {
      await resetStoredPet(dataDir)
      pet = activeFromStored(undefined, fallbackPet)
      setState({ kind: 'demo', state: 'done' })
      return jsonResponse(200, { ok: true, pet: publicPet(pet), event: state })
    } catch {
      return jsonResponse(500, { error: '无法恢复默认宠物', code: 'RESET_FAILED' })
    }
  }

  ctx.on('agent/status', ({ status }) => {
    setState({ kind: 'agent-status', status })
  })
  ctx.on('agent/pre-step', async (_payload, next) => {
    setState({ kind: 'pre-step' })
    return next()
  })
  ctx.on('tools/pre-execute', async (exec, next) => {
    setState({ kind: 'tool-start' }, { toolName: typeof exec?.name === 'string' ? exec.name : undefined })
    return next()
  })
  ctx.on('tools/result', (exec, result) => {
    setState({ kind: 'tool-result', failed: resultFailed(result) }, {
      toolName: typeof exec?.name === 'string' ? exec.name : undefined,
    })
  })
  ctx.on('session/event', (_session, event) => {
    if (!event || typeof event !== 'object') return
    if (event.type === 'tool/call') {
      setState({ kind: 'tool-start' }, { toolName: typeof event.name === 'string' ? event.name : undefined })
    } else if (event.type === 'tool/result') {
      setState({ kind: 'tool-result', failed: Boolean(event.error) })
    }
  })

  ctx.effect(() => {
    const disposers = [
      ctx.connection.fetch.register({
        path: '/api/agent-pet', methods: ['GET', 'POST'], requestBody: 'buffered', fetch: statusRoute,
      }),
      ctx.connection.fetch.register({
        path: '/api/agent-pet/avatar', methods: ['GET'], requestBody: 'buffered', fetch: avatarRoute,
      }),
      ctx.connection.fetch.register({
        path: '/api/agent-pet/generate', methods: ['POST'], requestBody: 'buffered', fetch: generateRoute,
      }),
      ctx.connection.fetch.register({
        path: '/api/agent-pet/reset', methods: ['POST'], requestBody: 'buffered', fetch: resetRoute,
      }),
    ]
    return () => {
      if (idleTimer) clearTimeout(idleTimer)
      for (const dispose of disposers.reverse()) dispose()
    }
  }, 'dsh-agent-pet: authenticated API, avatar, and generation')
}

