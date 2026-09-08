import assert from 'node:assert/strict'
import test from 'node:test'
import { decodePngBase64, downloadPng, generateOpenAiPet, parseGenerationRequest, readPngSize } from '../lib/pet-generation.js'

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(24),
])

test('normalizes a bounded pet generation request', () => {
  assert.deepEqual(parseGenerationRequest({ name: '  Miu  ', description: '  一只   紫色云朵狐狸  ', style: 'sticker' }), {
    ok: true,
    value: { name: 'Miu', description: '一只 紫色云朵狐狸', style: 'sticker' },
  })
  assert.equal(parseGenerationRequest({ name: '', description: 'short enough', style: 'auto' }).ok, false)
  assert.equal(parseGenerationRequest({ name: 'Miu', description: 'too', style: 'auto' }).ok, false)
  assert.equal(parseGenerationRequest({ name: 'Miu', description: 'a valid description', style: 'unknown' }).ok, false)
})

test('reads PNG dimensions straight from the IHDR chunk', () => {
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from([0, 0, 0, 13]),
    Buffer.from('IHDR'),
    (() => { const b = Buffer.alloc(8); b.writeUInt32BE(1536, 0); b.writeUInt32BE(1024, 4); return b })(),
  ])
  assert.deepEqual(readPngSize(png), { width: 1536, height: 1024 })
  assert.equal(readPngSize(Buffer.from('not a png at all, really')), undefined)
})

test('calls the image API without exposing the key in the prompt', async () => {
  let request
  const result = await generateOpenAiPet({
    apiKey: 'secret-key',
    prompt: 'draw a pet',
    fetchImpl: async (url, init) => {
      request = { url: String(url), init }
      return Response.json({ data: [{ b64_json: PNG.toString('base64') }] })
    },
  })
  assert.deepEqual(result.bytes, PNG)
  assert.equal(request.url, 'https://api.openai.com/v1/images/generations')
  assert.equal(request.init.headers.authorization, 'Bearer secret-key')
  const body = JSON.parse(request.init.body)
  assert.equal(body.model, 'gpt-image-2')
  assert.equal(body.background, 'transparent')
  assert.doesNotMatch(body.prompt, /secret-key/)
})

test('downloads the image when the provider returns a URL instead of base64', async () => {
  const requested = []
  const result = await generateOpenAiPet({
    apiKey: 'key',
    prompt: 'draw a pet',
    fetchImpl: async (url) => {
      requested.push(String(url))
      if (requested.length === 1) return Response.json({ data: [{ url: 'https://cdn.example/pet.png' }] })
      return new Response(PNG, { headers: { 'content-type': 'image/png' } })
    },
  })
  assert.deepEqual(result.bytes, PNG)
  assert.deepEqual(requested, ['https://api.openai.com/v1/images/generations', 'https://cdn.example/pet.png'])
})

test('rejects insecure, unreachable, and non-PNG image URLs', async () => {
  await assert.rejects(
    downloadPng('http://cdn.example/pet.png', { fetchImpl: async () => new Response(PNG) }),
    (error) => error.code === 'INSECURE_IMAGE_URL',
  )
  await assert.rejects(
    downloadPng('https://cdn.example/pet.png', { fetchImpl: async () => new Response('missing', { status: 404 }) }),
    (error) => error.code === 'IMAGE_DOWNLOAD_FAILED',
  )
  await assert.rejects(
    downloadPng('https://cdn.example/pet.png', { fetchImpl: async () => new Response(Buffer.from('<svg/>')) }),
    (error) => error.code === 'INVALID_IMAGE_RESPONSE',
  )
})

test('rejects provider errors and non-PNG output', async () => {
  await assert.rejects(
    generateOpenAiPet({
      apiKey: 'key', prompt: 'draw',
      fetchImpl: async () => Response.json({ error: { message: 'request rejected' } }, { status: 400 }),
    }),
    (error) => error.code === 'PROVIDER_REJECTED' && error.message === 'request rejected',
  )
  assert.throws(() => decodePngBase64(Buffer.from('not png').toString('base64')), /有效的 PNG/)
})

