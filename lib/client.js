window.__ModuleLoader__.load({
  id: 'dsh-agent-pet',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')
    const inject = ['slots']

    const stateClass = {
      idle: 'idle', thinking: 'thinking', running_tool: 'working',
      waiting_approval: 'waiting', done: 'done', error: 'error',
    }

    const styleLabels = {
      auto: '自动挑选', pixel: '像素', sticker: '贴纸', plush: '毛绒',
      'flat-vector': '扁平矢量', '3d-toy': '3D 玩具',
    }

    const MAX_NAME_LENGTH = 32
    const MAX_DESCRIPTION_LENGTH = 800
    const MIN_DESCRIPTION_LENGTH = 8

    function pendingForCurrent(snapshot, current) {
      return Boolean(current && snapshot && typeof snapshot.has === 'function' && snapshot.has(current))
    }

    function avatarUrl(revision) {
      return `/api/agent-pet/avatar?revision=${encodeURIComponent(revision || 'default')}`
    }

    // 打包自带的 pet.svg 是 180×160；单帧形象拿不到尺寸时沿用这个比例。
    const SINGLE_FRAME_RATIO = 180 / 160

    // 精灵表用 CSS background-position 切格子，不需要在任何一端解码 PNG。
    function spriteStyle(sheet, state, revision, height) {
      const columns = Math.max(1, (sheet && sheet.columns) || 1)
      const rows = Math.max(1, (sheet && sheet.rows) || 1)
      const known = Boolean(sheet && sheet.width && sheet.height)
      const cellRatio = known ? (sheet.width / columns) / (sheet.height / rows) : undefined
      const base = {
        height: `${height}px`,
        backgroundImage: `url(${avatarUrl(revision)})`,
        backgroundRepeat: 'no-repeat',
      }

      // 单帧形象（默认宠物、老数据、用户只上传一张图）宽高比未知，
      // 用 contain 保证不变形——等价于以前 <img> 上的 object-fit: contain。
      if (columns === 1 && rows === 1) {
        return {
          ...base,
          width: `${Math.round(height * (cellRatio || SINGLE_FRAME_RATIO))}px`,
          backgroundSize: 'contain',
          backgroundPosition: 'center',
        }
      }

      const poses = (sheet && Array.isArray(sheet.poses)) ? sheet.poses : []
      let index = poses.indexOf(state)
      if (index < 0) index = poses.indexOf('idle')
      if (index < 0 || index >= columns * rows) index = 0
      const column = index % columns
      const row = Math.floor(index / columns)
      return {
        ...base,
        // 显示框的宽高比必须等于单格宽高比，否则百分比背景会把宠物拉变形。
        width: `${Math.round(height * (cellRatio || 1))}px`,
        backgroundSize: `${columns * 100}% ${rows * 100}%`,
        backgroundPosition: `${columns > 1 ? (column / (columns - 1)) * 100 : 0}% ${rows > 1 ? (row / (rows - 1)) * 100 : 0}%`,
      }
    }

    function readPngAsBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(new Error('读取文件失败'))
        reader.onload = () => {
          const result = String(reader.result || '')
          const comma = result.indexOf(',')
          if (!result.startsWith('data:image/png') || comma < 0) {
            reject(new Error('只接受 PNG 图片'))
            return
          }
          resolve(result.slice(comma + 1))
        }
        reader.readAsDataURL(file)
      })
    }

    async function readJson(response) {
      try {
        return await response.json()
      } catch {
        return null
      }
    }

    function PetStudio(props) {
      const generation = props.generation || {}
      const styles = Array.isArray(generation.styles) && generation.styles.length
        ? generation.styles
        : Object.keys(styleLabels)
      const nameState = React.useState(props.petName || '')
      const name = nameState[0]
      const setName = nameState[1]
      const descriptionState = React.useState(props.petDescription || '')
      const description = descriptionState[0]
      const setDescription = descriptionState[1]
      const styleState = React.useState(styles.includes(props.petStyle) ? props.petStyle : 'auto')
      const style = styleState[0]
      const setStyle = styleState[1]
      const busyState = React.useState('')
      const busy = busyState[0]
      const setBusy = busyState[1]
      const errorState = React.useState('')
      const error = errorState[0]
      const setError = errorState[1]
      const noticeState = React.useState('')
      const notice = noticeState[0]
      const setNotice = noticeState[1]
      const promptState = React.useState(null)
      const exported = promptState[0]
      const setExported = promptState[1]
      const gridState = React.useState({ columns: 4, rows: 2 })
      const grid = gridState[0]
      const setGrid = gridState[1]
      const card = React.useRef(null)
      const fileInput = React.useRef(null)
      const onClose = props.onClose

      React.useEffect(() => {
        function onKeyDown(event) {
          if (event.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKeyDown)
        const field = card.current && card.current.querySelector('input,textarea')
        if (field) field.focus()
        return () => window.removeEventListener('keydown', onKeyDown)
      }, [onClose])

      const missingKey = generation.available === false
      const trimmedName = name.trim()
      const trimmedDescription = description.trim()
      const ready = Boolean(trimmedName)
        && trimmedName.length <= MAX_NAME_LENGTH
        && trimmedDescription.length >= MIN_DESCRIPTION_LENGTH
        && trimmedDescription.length <= MAX_DESCRIPTION_LENGTH
      const locked = Boolean(busy) || generation.busy === true

      async function run(path, body, workingLabel, successLabel) {
        setBusy(workingLabel)
        setError('')
        setNotice('')
        try {
          const response = await fetch(path, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          })
          const payload = await readJson(response)
          if (!response.ok) {
            setError((payload && payload.error) || '这次请求没有成功，请稍后重试')
            return
          }
          setNotice(successLabel)
          if (props.onUpdated) props.onUpdated(payload)
        } catch {
          setError('无法连接本地 DSH 服务')
        } finally {
          setBusy('')
        }
      }

      function generate(event) {
        event.preventDefault()
        if (!ready || locked || missingKey) return
        run(
          '/api/agent-pet/generate',
          { name: trimmedName, description: trimmedDescription, style },
          '正在绘制…',
          '新宠物已经上线',
        )
      }

      function restore() {
        if (locked) return
        run('/api/agent-pet/reset', {}, '正在恢复…', '已经恢复默认宠物')
      }

      // 导出提示词：不需要 API Key、不产生费用，拿去任何生图 AI 都能用。
      async function exportPrompt() {
        if (!ready) return
        setError('')
        setNotice('')
        try {
          const response = await fetch('/api/agent-pet/prompt', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: trimmedName, description: trimmedDescription, style }),
          })
          const payload = await readJson(response)
          if (!response.ok) {
            setError((payload && payload.error) || '无法生成提示词')
            return
          }
          setExported(payload)
        } catch {
          setError('无法连接本地 DSH 服务')
        }
      }

      async function copyPrompt() {
        if (!exported) return
        try {
          await navigator.clipboard.writeText(exported.prompt)
          setNotice('提示词已复制')
        } catch {
          setError('复制失败，请手动选中文本复制')
        }
      }

      async function importSheet(event) {
        const file = event.target.files && event.target.files[0]
        event.target.value = ''
        if (!file || locked) return
        if (!ready) {
          setError('请先填好名字和外观描述，导入的形象也要有这些信息')
          return
        }
        if (file.size > 12 * 1024 * 1024) {
          setError('图片超过 12 MB，请先压缩')
          return
        }
        setBusy('正在导入…')
        setError('')
        setNotice('')
        try {
          const image = await readPngAsBase64(file)
          const response = await fetch('/api/agent-pet/import', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              name: trimmedName,
              description: trimmedDescription,
              style,
              image,
              sheet: { columns: grid.columns, rows: grid.rows },
            }),
          })
          const payload = await readJson(response)
          if (!response.ok) {
            setError((payload && payload.error) || '导入失败')
            return
          }
          setNotice('精灵表已导入')
          if (props.onUpdated) props.onUpdated(payload)
        } catch (failure) {
          setError(failure && failure.message ? failure.message : '导入失败')
        } finally {
          setBusy('')
        }
      }

      return React.createElement('div', {
        className: 'agentPetStudio',
        onPointerDown: (event) => { if (event.target === event.currentTarget) onClose() },
      },
      React.createElement('form', {
        className: 'agentPetStudio__card',
        ref: card,
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': '宠物工作室',
        onSubmit: generate,
      },
      React.createElement('header', { className: 'agentPetStudio__head' },
        React.createElement('h2', null, '宠物工作室'),
        React.createElement('button', {
          type: 'button', className: 'agentPetStudio__close', onClick: onClose,
          'aria-label': '关闭工作室', title: '关闭工作室',
        }, '×')),

      React.createElement('div', { className: 'agentPetStudio__preview' },
        React.createElement('div', {
          className: 'agentPetStudio__frames',
          role: 'img',
          'aria-label': `当前宠物 ${props.petName || ''} 的各个状态`,
        }, (props.sheet && Array.isArray(props.sheet.poses) ? props.sheet.poses : ['idle']).map((pose) =>
          React.createElement('span', {
            key: pose,
            title: pose,
            style: spriteStyle(props.sheet, pose, props.revision, 52),
          }))),
        React.createElement('span', { className: 'agentPetStudio__previewNote' },
          busy || (generation.busy ? '正在绘制…' : `当前：${props.petName || 'Momo'}`))),

      missingKey
        ? React.createElement('p', { className: 'agentPetStudio__hint' },
          `请先在 DSH 中配置 ${generation.credentialRef || 'OPENAI_API_KEY'}，然后重新打开工作室。`)
        : null,

      React.createElement('label', { className: 'agentPetStudio__field' },
        React.createElement('span', null, '名字'),
        React.createElement('input', {
          type: 'text', value: name, maxLength: MAX_NAME_LENGTH, disabled: locked,
          placeholder: 'Momo', onChange: (event) => setName(event.target.value),
        })),

      React.createElement('label', { className: 'agentPetStudio__field' },
        React.createElement('span', null, `外观描述（${trimmedDescription.length}/${MAX_DESCRIPTION_LENGTH}）`),
        React.createElement('textarea', {
          value: description, rows: 4, maxLength: MAX_DESCRIPTION_LENGTH, disabled: locked,
          placeholder: '一只圆滚滚的云朵小猫，浅紫色绒毛，尾巴尖是星星',
          onChange: (event) => setDescription(event.target.value),
        })),

      React.createElement('label', { className: 'agentPetStudio__field' },
        React.createElement('span', null, '画风'),
        React.createElement('select', {
          value: style, disabled: locked, onChange: (event) => setStyle(event.target.value),
        }, styles.map((value) => React.createElement('option', { key: value, value }, styleLabels[value] || value)))),

      error ? React.createElement('p', { className: 'agentPetStudio__error', role: 'alert' }, error) : null,
      notice ? React.createElement('p', { className: 'agentPetStudio__notice' }, notice) : null,

      React.createElement('p', { className: 'agentPetStudio__meta' },
        `绘制会生成一张 ${grid.columns}×${grid.rows} 的精灵表，八个状态各一格。调用 ${generation.model || '图片模型'}，可能产生服务商费用；每次只能生成一只。`),

      React.createElement('div', { className: 'agentPetStudio__actions' },
        React.createElement('button', {
          type: 'button', className: 'agentPetStudio__ghost', onClick: restore, disabled: locked,
        }, '恢复默认'),
        React.createElement('button', {
          type: 'submit', className: 'agentPetStudio__primary', disabled: locked || !ready || missingKey,
        }, locked ? busy || '正在绘制…' : '开始绘制')),

      React.createElement('details', { className: 'agentPetStudio__external' },
        React.createElement('summary', null, '用别的 AI 生成（不需要 API Key）'),
        React.createElement('p', { className: 'agentPetStudio__meta' },
          '复制提示词，拿到任意生图 AI 里生成一张透明背景的精灵表，再把 PNG 导回来。'),

        React.createElement('div', { className: 'agentPetStudio__gridRow' },
          React.createElement('label', null, '列',
            React.createElement('input', {
              type: 'number', min: 1, max: 8, value: grid.columns, disabled: locked,
              onChange: (event) => setGrid({ ...grid, columns: Number(event.target.value) || 1 }),
            })),
          React.createElement('label', null, '行',
            React.createElement('input', {
              type: 'number', min: 1, max: 8, value: grid.rows, disabled: locked,
              onChange: (event) => setGrid({ ...grid, rows: Number(event.target.value) || 1 }),
            })),
          React.createElement('span', null, '按那个 AI 实际输出的网格填')),

        React.createElement('div', { className: 'agentPetStudio__actions' },
          React.createElement('button', {
            type: 'button', className: 'agentPetStudio__ghost', onClick: exportPrompt, disabled: !ready,
          }, '生成提示词'),
          React.createElement('button', {
            type: 'button', className: 'agentPetStudio__ghost', disabled: locked,
            onClick: () => fileInput.current && fileInput.current.click(),
          }, '导入精灵表 PNG'),
          React.createElement('input', {
            ref: fileInput, type: 'file', accept: 'image/png', hidden: true, onChange: importSheet,
          })),

        exported ? React.createElement('div', { className: 'agentPetStudio__exported' },
          React.createElement('textarea', { readOnly: true, rows: 8, value: exported.prompt }),
          React.createElement('div', { className: 'agentPetStudio__actions' },
            React.createElement('button', {
              type: 'button', className: 'agentPetStudio__ghost', onClick: copyPrompt,
            }, '复制提示词')),
          React.createElement('ul', null,
            (exported.layout && Array.isArray(exported.layout.notes) ? exported.layout.notes : [])
              .map((note, index) => React.createElement('li', { key: index }, note))),
          React.createElement('p', { className: 'agentPetStudio__meta' },
            `姿势顺序：${(exported.layout && exported.layout.poses ? exported.layout.poses : []).join(' → ')}`))
          : null)))
    }

    function PetOverlay(props) {
      const selected = props.useSessions((sessions) => sessions.current)
      const pending = props.useSessionPendingInteraction((snapshot) => pendingForCurrent(snapshot, selected))
      const dataState = React.useState(null)
      const data = dataState[0]
      const setData = dataState[1]
      const hiddenState = React.useState(false)
      const hidden = hiddenState[0]
      const setHidden = hiddenState[1]
      const positionState = React.useState({ right: 24, bottom: 24 })
      const position = positionState[0]
      const setPosition = positionState[1]
      const studioState = React.useState(false)
      const studioOpen = studioState[0]
      const setStudioOpen = studioState[1]
      const drag = React.useRef(null)
      const refreshRef = React.useRef(null)

      React.useEffect(() => {
        let active = true
        async function refresh() {
          try {
            const response = await fetch('/api/agent-pet', { cache: 'no-store' })
            const next = await response.json()
            if (active && response.ok) setData(next)
          } catch {
            if (active) setData(null)
          }
        }
        refreshRef.current = refresh
        refresh()
        const timer = setInterval(refresh, 450)
        return () => { active = false; refreshRef.current = null; clearInterval(timer) }
      }, [])

      React.useEffect(() => {
        function move(event) {
          if (!drag.current) return
          const nextRight = Math.max(8, Math.min(window.innerWidth - 116, drag.current.right - (event.clientX - drag.current.x)))
          const nextBottom = Math.max(8, Math.min(window.innerHeight - 116, drag.current.bottom - (event.clientY - drag.current.y)))
          setPosition({ right: nextRight, bottom: nextBottom })
        }
        function end() { drag.current = null }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', end)
        return () => {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', end)
        }
      }, [])

      if (hidden) {
        return React.createElement('button', {
          className: 'agentPetRestore',
          style: position,
          onClick: () => setHidden(false),
          'aria-label': '显示 Momo',
          title: '显示 Momo',
        }, '🐾')
      }

      const rawState = pending ? 'waiting_approval' : data?.event?.state || 'idle'
      const label = pending ? '等你确认一下' : data?.event?.label || '正在连接 Momo'
      const name = data?.pet?.name || 'Momo'
      const revision = data?.pet?.revision || 'default'

      const sheet = data?.pet?.sheet
      const studio = studioOpen
        ? React.createElement(PetStudio, {
          generation: data?.generation,
          petName: name,
          petDescription: data?.pet?.description,
          petStyle: data?.pet?.style,
          sheet,
          revision,
          onClose: () => setStudioOpen(false),
          onUpdated: (payload) => {
            if (payload?.pet) setData((previous) => (previous ? { ...previous, pet: payload.pet } : previous))
            if (refreshRef.current) refreshRef.current()
          },
        })
        : null

      return React.createElement(React.Fragment, null, studio, React.createElement('section', {
        className: `agentPet agentPet--${stateClass[rawState] || 'idle'}`,
        style: position,
        'aria-live': 'polite',
        onPointerDown: (event) => {
          if (event.target.closest('button')) return
          drag.current = { x: event.clientX, y: event.clientY, right: position.right, bottom: position.bottom }
        },
      },
      React.createElement('button', {
        className: 'agentPet__hide',
        onClick: () => setHidden(true),
        'aria-label': '隐藏宠物',
        title: '隐藏宠物',
      }, '×'),
      React.createElement('button', {
        className: 'agentPet__studio',
        onClick: () => setStudioOpen(true),
        'aria-label': '打开宠物工作室',
        title: '画一只新宠物',
      }, '🎨'),
      React.createElement('div', { className: 'agentPet__bubble' }, label),
      React.createElement('div', {
        className: 'agentPet__body',
        role: 'img',
        'aria-label': `${name}，${label}`,
        style: spriteStyle(sheet, rawState, revision, 96),
      },
        React.createElement('span', { className: 'agentPet__spark agentPet__spark--one' }, '✦'),
        React.createElement('span', { className: 'agentPet__spark agentPet__spark--two' }, '·'),
        rawState === 'running_tool' ? React.createElement('span', { className: 'agentPet__tool' }, '⚙') : null),
      React.createElement('strong', { className: 'agentPet__name' }, name)))
    }

    function apply(ctx) {
      const css = `
        .agentPet,.agentPetRestore{position:fixed;z-index:70;pointer-events:auto;box-sizing:border-box}
        .agentPet{width:132px;display:flex;flex-direction:column;align-items:center;cursor:grab;user-select:none;touch-action:none;filter:drop-shadow(0 10px 18px rgba(35,27,65,.18))}
        .agentPet:active{cursor:grabbing}.agentPet__body{position:relative;display:grid;place-items:center;transform-origin:50% 90%}
        .agentPet__bubble{max-width:128px;margin-bottom:-5px;padding:7px 10px;border:1px solid color-mix(in srgb,var(--dsw-alias-border-l1) 75%,#8d7cff);border-radius:13px 13px 13px 4px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 92%,#ece8ff);color:var(--dsw-alias-label-primary);font-size:12px;line-height:1.25;text-align:center;white-space:nowrap}
        .agentPet__name{margin-top:-5px;padding:2px 8px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 86%,#8d7cff);color:var(--dsw-alias-label-secondary);font-size:11px;font-weight:650}.agentPet__hide,.agentPet__studio{position:absolute;top:4px;width:22px;height:22px;border:0;border-radius:50%;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);cursor:pointer;opacity:0;transition:opacity .15s;font-size:11px;line-height:1;display:grid;place-items:center}.agentPet__hide{right:0}.agentPet__studio{left:0}.agentPet:hover .agentPet__hide,.agentPet:hover .agentPet__studio,.agentPet__hide:focus-visible,.agentPet__studio:focus-visible{opacity:1}
        .agentPet__spark{position:absolute;color:#8d7cff;opacity:0}.agentPet__spark--one{left:4px;top:8px}.agentPet__spark--two{right:5px;top:23px}.agentPet__tool{position:absolute;right:2px;bottom:5px;display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#7565ed;color:white;font-size:15px}
        .agentPet--idle .agentPet__body{animation:petBreathe 2.7s ease-in-out infinite}.agentPet--thinking .agentPet__body{animation:petThink 1.1s ease-in-out infinite}.agentPet--thinking .agentPet__spark{animation:petSpark 1.3s ease-in-out infinite}.agentPet--thinking .agentPet__spark--two{animation-delay:.45s}.agentPet--working .agentPet__body{animation:petWork .55s ease-in-out infinite alternate}.agentPet--working .agentPet__tool{animation:petSpin 1.2s linear infinite}.agentPet--waiting .agentPet__body{animation:petWait .8s ease-in-out infinite alternate}.agentPet--waiting .agentPet__bubble{border-color:#f0a64f;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 82%,#fff1d2)}.agentPet--done .agentPet__body{animation:petDone .7s ease-out 2}.agentPet--error .agentPet__body{animation:petError .35s ease-in-out 3}.agentPet--error .agentPet__bubble{border-color:#e36778;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 82%,#ffe2e7)}
        .agentPetRestore{width:42px;height:42px;border:1px solid var(--dsw-alias-border-l1);border-radius:50%;background:var(--dsw-alias-bg-layer-1);cursor:pointer;box-shadow:0 8px 18px rgba(35,27,65,.15);font-size:18px}
        @keyframes petBreathe{50%{transform:translateY(-3px) scale(1.015)}}@keyframes petThink{25%{transform:rotate(-3deg) translateY(-2px)}75%{transform:rotate(3deg) translateY(-4px)}}@keyframes petWork{to{transform:translateY(-5px) scaleX(1.025)}}@keyframes petWait{to{transform:translateY(-7px)}}@keyframes petDone{40%{transform:translateY(-18px) scale(1.05)}70%{transform:translateY(0) scaleX(1.1) scaleY(.9)}}@keyframes petError{25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}@keyframes petSpark{45%{opacity:1;transform:translateY(-6px) scale(1.25)}100%{opacity:0;transform:translateY(-12px)}}@keyframes petSpin{to{transform:rotate(360deg)}}
        .agentPetStudio{position:fixed;inset:0;z-index:80;display:grid;place-items:center;padding:20px;background:rgba(28,22,52,.42);backdrop-filter:blur(2px)}
        .agentPetStudio__card{box-sizing:border-box;width:min(420px,100%);max-height:calc(100vh - 40px);overflow:auto;display:flex;flex-direction:column;gap:12px;padding:18px 20px 20px;border:1px solid var(--dsw-alias-border-l1);border-radius:16px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:0 24px 60px rgba(28,22,52,.28)}
        .agentPetStudio__head{display:flex;align-items:center;justify-content:space-between}.agentPetStudio__head h2{margin:0;font-size:15px;font-weight:680}
        .agentPetStudio__close{width:26px;height:26px;border:0;border-radius:50%;background:transparent;color:var(--dsw-alias-label-secondary);font-size:17px;cursor:pointer}.agentPetStudio__close:hover{background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 80%,#8d7cff)}
        .agentPetStudio__preview{display:flex;flex-direction:column;gap:8px;padding:10px;border:1px dashed var(--dsw-alias-border-l1);border-radius:12px}
        .agentPetStudio__frames{display:flex;flex-wrap:wrap;gap:4px}.agentPetStudio__frames span{flex:0 0 auto}
        .agentPetStudio__previewNote{font-size:12px;color:var(--dsw-alias-label-secondary)}
        .agentPetStudio__external{border:1px solid var(--dsw-alias-border-l1);border-radius:11px;padding:10px 12px}
        .agentPetStudio__external summary{cursor:pointer;font-size:12px;font-weight:620;color:var(--dsw-alias-label-primary)}
        .agentPetStudio__external>*{margin-top:8px}
        .agentPetStudio__gridRow{display:flex;align-items:center;gap:10px;font-size:12px;color:var(--dsw-alias-label-secondary)}
        .agentPetStudio__gridRow label{display:flex;align-items:center;gap:4px}
        .agentPetStudio__gridRow input{width:52px;padding:4px 6px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px}
        .agentPetStudio__exported textarea{box-sizing:border-box;width:100%;padding:8px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-2,transparent);color:var(--dsw-alias-label-primary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:1.45;resize:vertical}
        .agentPetStudio__exported ul{margin:8px 0 0;padding-left:18px;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary)}
        .agentPetStudio__field{display:flex;flex-direction:column;gap:5px;font-size:12px;color:var(--dsw-alias-label-secondary)}
        .agentPetStudio__field input,.agentPetStudio__field textarea,.agentPetStudio__field select{box-sizing:border-box;width:100%;padding:8px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-2,transparent);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;resize:vertical}
        .agentPetStudio__field input:focus-visible,.agentPetStudio__field textarea:focus-visible,.agentPetStudio__field select:focus-visible{outline:2px solid #8d7cff;outline-offset:1px}
        .agentPetStudio__hint,.agentPetStudio__error,.agentPetStudio__notice,.agentPetStudio__meta{margin:0;font-size:12px;line-height:1.4}
        .agentPetStudio__hint{padding:8px 10px;border-radius:9px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 82%,#fff1d2);color:var(--dsw-alias-label-primary)}
        .agentPetStudio__error{color:#c9455a}.agentPetStudio__notice{color:#2f8f63}.agentPetStudio__meta{color:var(--dsw-alias-label-secondary)}
        .agentPetStudio__actions{display:flex;justify-content:flex-end;gap:8px;margin-top:2px}
        .agentPetStudio__ghost,.agentPetStudio__primary{padding:8px 16px;border-radius:999px;font:inherit;font-size:13px;font-weight:620;cursor:pointer}
        .agentPetStudio__ghost{border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary)}
        .agentPetStudio__primary{border:0;background:#7565ed;color:#fff}
        .agentPetStudio__ghost:disabled,.agentPetStudio__primary:disabled{opacity:.55;cursor:not-allowed}
        @media(prefers-reduced-motion:reduce){.agentPet *{animation:none!important;transition:none!important}}
      `
      const style = document.createElement('style')
      style.textContent = css
      document.head.appendChild(style)
      ctx.effect(() => () => style.remove(), 'dsh-agent-pet: styles')
      ctx.slots.inject('shell.overlay', () => ctx.slots.register(
        { name: 'shell.overlay', id: 'agent-pet', order: 40, label: 'Agent Pet' },
        (props) => React.createElement(PetOverlay, props),
      ))
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
