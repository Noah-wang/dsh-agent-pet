import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPetPrompt, decodePngBase64, generateOpenAiPet, parseGenerationRequest } from '../lib/pet-generation.js'

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

test('builds a production prompt with transparent background constraints', () => {
  const prompt = buildPetPrompt({ name: 'Miu', description: 'a small cloud fox', style: 'plush' })
  assert.match(prompt, /Miu/)
  assert.match(prompt, /cloud fox/)
  assert.match(prompt, /Transparent background/)
  assert.match(prompt, /No scenery/)
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

