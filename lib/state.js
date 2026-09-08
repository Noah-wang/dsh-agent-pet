export const PET_STATES = Object.freeze([
  'idle',
  'thinking',
  'running_tool',
  'waiting_approval',
  'done',
  'error',
])

export const DEFAULT_LABELS = Object.freeze({
  idle: '在这里陪着你',
  thinking: '正在认真思考',
  running_tool: '正在帮你做事',
  waiting_approval: '等你确认一下',
  done: '完成啦',
  error: '遇到了一点问题',
})

export function isPetState(value) {
  return PET_STATES.includes(value)
}

export function normalizeObservation(observation, previous = 'idle') {
  if (!observation || typeof observation !== 'object') return previous
  switch (observation.kind) {
    case 'agent-status':
      return observation.status === 'running' ? 'thinking' : observation.status === 'idle' ? 'done' : previous
    case 'pre-step':
      return 'thinking'
    case 'tool-start':
      return 'running_tool'
    case 'tool-result':
      return observation.failed ? 'error' : 'thinking'
    case 'approval':
      return observation.pending ? 'waiting_approval' : previous
    case 'request-error':
      return 'error'
    case 'demo':
      return isPetState(observation.state) ? observation.state : previous
    default:
      return previous
  }
}

export function createStateEvent(state, details = {}) {
  if (!isPetState(state)) throw new TypeError(`Unknown pet state: ${String(state)}`)
  return {
    version: 1,
    state,
    label: typeof details.label === 'string' ? details.label : DEFAULT_LABELS[state],
    ...(typeof details.toolName === 'string' && details.toolName ? { toolName: details.toolName } : {}),
    timestamp: Number.isFinite(details.timestamp) ? details.timestamp : Date.now(),
  }
}
