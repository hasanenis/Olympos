import { CanvasData, CanvasEdge, CanvasNode } from "../pages/Canvas"

type Point = { x: number; y: number }

type ViewerState = {
  scale: number
  translateX: number
  translateY: number
  minScale: number
  maxScale: number
  width: number
  height: number
}

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
  msRequestFullscreen?: () => Promise<void> | void
}

type FullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void
  msExitFullscreen?: () => Promise<void> | void
  webkitFullscreenElement?: Element | null
  msFullscreenElement?: Element | null
}

type EdgeElementRecord = {
  id: string
  path: SVGPathElement
  label?: SVGTextElement
  from: string
  to: string
}

type EdgeCollections = {
  elements: Map<string, EdgeElementRecord>
  byNode: Map<string, Set<string>>
}

type WikiLinkRecord = {
  element: HTMLButtonElement
  target: string
  raw: string
  sourceId: string
}

type Cleanup = () => void

type InteractionControls = {
  cleanup: Cleanup
  applyTransform: () => void
  focusCanvasPoint: (point: Point, options?: { animate?: boolean; minScale?: number }) => void
  state: ViewerState
}

type GlowElement = HTMLElement | SVGPathElement | SVGTextElement

type GlowController = {
  value: number
  target: number
  raf: number | null
  step: (timestamp: number) => void
}

type IdleCallback = (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void

const WIKILINK_PATTERN = /\[\[([^\]]+)\]\]/g
const EDGE_FLASH_DURATION = 480
const NODE_FLASH_DURATION = 640

const glowRegistry = new WeakMap<GlowElement, Map<string, GlowController>>()

const scheduleIdle = (callback: () => void, timeout = 48) => {
  if (typeof window === "undefined") {
    return
  }
  const idleWindow = window as Window & { requestIdleCallback?: (cb: IdleCallback, opts?: { timeout?: number }) => number }
  if (typeof idleWindow.requestIdleCallback === "function") {
    idleWindow.requestIdleCallback(() => callback(), { timeout })
  } else {
    window.setTimeout(callback, timeout)
  }
}

function setGlowTarget(element: GlowElement, property: string, target: number, options?: { immediate?: boolean }) {
  let propertyMap = glowRegistry.get(element)
  if (!propertyMap) {
    propertyMap = new Map<string, GlowController>()
    glowRegistry.set(element, propertyMap)
  }

  let controller = propertyMap.get(property)
  if (!controller) {
    controller = {
      value: Number.parseFloat(element.style.getPropertyValue(property)) || 0,
      target,
      raf: null,
      step: () => {},
    }

    controller.step = () => {
      const delta = controller!.target - controller!.value
      if (Math.abs(delta) <= 0.003) {
        controller!.value = controller!.target
        element.style.setProperty(property, controller!.value.toFixed(3))
        controller!.raf = null
        return
      }
      controller!.value += delta * 0.22
      element.style.setProperty(property, controller!.value.toFixed(3))
      controller!.raf = window.requestAnimationFrame(controller!.step)
    }

    propertyMap.set(property, controller)
  }

  controller.target = target

  if (options?.immediate) {
    controller.value = target
    element.style.setProperty(property, controller.value.toFixed(3))
    if (controller.raf !== null) {
      window.cancelAnimationFrame(controller.raf)
      controller.raf = null
    }
    return
  }

  if (controller.raf === null) {
    controller.raf = window.requestAnimationFrame(controller.step)
  }
}

function animateGlow(element: GlowElement | null | undefined, property: string, active: boolean) {
  if (!element) {
    return
  }
  setGlowTarget(element, property, active ? 1 : 0)
}

function pulseGlow(element: GlowElement | null | undefined, property: string, peak = 1.18, hold = 360) {
  if (!element) {
    return
  }
  setGlowTarget(element, property, peak)
  window.setTimeout(() => {
    scheduleIdle(() => setGlowTarget(element, property, 0))
  }, hold)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function normaliseKey(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  return trimmed.toLowerCase().replace(/\s+/g, " ")
}

function formatText(
  text: string | undefined,
  sourceId: string,
  registerWikiLink: (record: WikiLinkRecord) => void,
): DocumentFragment {
  const frag = document.createDocumentFragment()
  if (!text) {
    return frag
  }

  const lines = text.split(/\r?\n/)
  lines.forEach((line, idx) => {
    let cursor = 0
    for (const match of line.matchAll(WIKILINK_PATTERN)) {
      const [fullMatch, rawTarget] = match
      const matchIndex = match.index ?? 0
      if (matchIndex > cursor) {
        frag.append(document.createTextNode(line.slice(cursor, matchIndex)))
      }
      const button = document.createElement("button")
      button.type = "button"
      button.className = "canvas-wikilink"
      const textContent = rawTarget.trim()
      button.textContent = textContent
      button.dataset.sourceId = sourceId
      const normalised = normaliseKey(rawTarget)
      if (normalised) {
        button.dataset.target = normalised
        registerWikiLink({
          element: button,
          target: normalised,
          raw: textContent,
          sourceId,
        })
      } else {
        button.disabled = true
        button.classList.add("canvas-wikilink-disabled")
      }
      frag.append(button)
      cursor = matchIndex + fullMatch.length
    }
    if (cursor < line.length) {
      frag.append(document.createTextNode(line.slice(cursor)))
    }
    if (idx < lines.length - 1) {
      frag.append(document.createElement("br"))
    }
  })
  return frag
}

function anchorFor(node: CanvasNode, side?: CanvasEdge["fromSide"], offset?: Point): Point {
  const origin = offset ?? { x: 0, y: 0 }
  const x = node.x - origin.x
  const y = node.y - origin.y
  switch (side) {
    case "top":
      return { x: x + node.width / 2, y }
    case "bottom":
      return { x: x + node.width / 2, y: y + node.height }
    case "left":
      return { x, y: y + node.height / 2 }
    case "right":
      return { x: x + node.width, y: y + node.height / 2 }
    default:
      return { x: x + node.width / 2, y: y + node.height / 2 }
  }
}

function createNodeElement(
  node: CanvasNode,
  offset: Point,
  registerWikiLink: (record: WikiLinkRecord) => void,
): HTMLDivElement {
  const el = document.createElement("div")
  el.className = `canvas-node canvas-node-${node.type}`
  el.style.left = `${node.x - offset.x}px`
  el.style.top = `${node.y - offset.y}px`
  el.style.width = `${node.width}px`
  el.style.height = `${node.height}px`
  el.dataset.nodeId = node.id
  el.tabIndex = 0
  el.style.setProperty("--canvas-node-glow", "0")
  el.style.setProperty("--canvas-node-ping", "0")

  if (node.background) {
    el.style.setProperty("--canvas-node-bg", node.background)
  }
  if (node.color) {
    el.style.setProperty("--canvas-node-color", node.color)
  }

  const content = document.createElement("div")
  content.className = "canvas-node-content"

  const register = (record: WikiLinkRecord) => registerWikiLink(record)

  if (node.type === "text") {
    content.append(formatText(node.text, node.id, register))
  } else if (node.type === "file" && node.file?.path) {
    const link = document.createElement("a")
    link.href = node.file.path
    link.textContent = node.label ?? node.file.path
    link.className = "canvas-node-link"
    content.append(link)
    if (node.text) {
      content.append(document.createElement("br"))
      content.append(formatText(node.text, node.id, register))
    }
  } else if (node.type === "link" && node.url) {
    const anchor = document.createElement("a")
    anchor.href = node.url
    anchor.target = "_blank"
    anchor.rel = "noopener noreferrer"
    anchor.textContent = node.label ?? node.url
    anchor.className = "canvas-node-link"
    content.append(anchor)
    if (node.text) {
      content.append(document.createElement("br"))
      content.append(formatText(node.text, node.id, register))
    }
  } else if (node.type === "image" && node.image) {
    const img = document.createElement("img")
    img.src = node.image
    img.alt = node.label ?? "Canvas image"
    content.append(img)
    if (node.text) {
      content.append(document.createElement("br"))
      content.append(formatText(node.text, node.id, register))
    }
  } else {
    if (node.label) {
      const heading = document.createElement("strong")
      heading.textContent = node.label
      content.append(heading)
      if (node.text) {
        content.append(document.createElement("br"))
      }
    }
    if (node.text) {
      content.append(formatText(node.text, node.id, register))
    }
  }

  el.append(content)
  return el
}

function renderEdges(
  svg: SVGSVGElement,
  nodes: Map<string, CanvasNode>,
  edges: CanvasEdge[] | undefined,
  offset: Point,
  nodeElements: Map<string, HTMLDivElement>,
): EdgeCollections {
  while (svg.firstChild) {
    svg.removeChild(svg.firstChild)
  }

  if (!edges || edges.length === 0) {
    return { elements: new Map(), byNode: new Map() }
  }

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs")
  const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker")
  marker.setAttribute("id", "canvas-arrow")
  marker.setAttribute("markerWidth", "10")
  marker.setAttribute("markerHeight", "10")
  marker.setAttribute("refX", "8")
  marker.setAttribute("refY", "3")
  marker.setAttribute("orient", "auto")
  const markerPath = document.createElementNS("http://www.w3.org/2000/svg", "path")
  markerPath.setAttribute("d", "M0,0 L10,3 L0,6 z")
  markerPath.setAttribute("fill", "currentColor")
  marker.append(markerPath)
  defs.append(marker)
  svg.append(defs)

  const group = document.createElementNS("http://www.w3.org/2000/svg", "g")
  group.setAttribute("class", "canvas-edges-group")
  svg.append(group)

  const edgeElements = new Map<string, EdgeElementRecord>()
  const edgesByNode = new Map<string, Set<string>>()

  const registerNodeEdge = (nodeId: string, edgeId: string) => {
    if (!edgesByNode.has(nodeId)) {
      edgesByNode.set(nodeId, new Set())
    }
    edgesByNode.get(nodeId)!.add(edgeId)
  }

  edges.forEach((edge) => {
    const from = nodes.get(edge.fromNode)
    const to = nodes.get(edge.toNode)
    if (!from || !to) return

    const edgeId = edge.id ?? `${edge.fromNode}-${edge.toNode}`
    const start = anchorFor(from, edge.fromSide, offset)
    const end = anchorFor(to, edge.toSide, offset)

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
    const midX = (start.x + end.x) / 2
    const midY = (start.y + end.y) / 2
    const d = `M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`
    path.setAttribute("d", d)
    path.setAttribute("class", "canvas-edge")
    path.setAttribute("marker-end", "url(#canvas-arrow)")
    path.tabIndex = 0
    path.dataset.edgeId = edgeId
    path.dataset.fromNode = edge.fromNode
    path.dataset.toNode = edge.toNode
    path.style.setProperty("--canvas-edge-glow", "0")
    group.append(path)

    registerNodeEdge(edge.fromNode, edgeId)
    registerNodeEdge(edge.toNode, edgeId)

    let text: SVGTextElement | undefined
    if (edge.label) {
      text = document.createElementNS("http://www.w3.org/2000/svg", "text")
      text.textContent = edge.label
      const labelX = (start.x + end.x) / 2
      const labelY = (start.y + end.y) / 2 - 8
      text.setAttribute("x", labelX.toString())
      text.setAttribute("y", labelY.toString())
      text.setAttribute("class", "canvas-edge-label")
      text.dataset.edgeId = edgeId
      text.style.setProperty("--canvas-edge-label-glow", "0")
      group.append(text)
    }

    const fromElement = nodeElements.get(edge.fromNode)
    const toElement = nodeElements.get(edge.toNode)

    const toggleActive = (active: boolean) => {
      animateGlow(path, "--canvas-edge-glow", active)
      path.classList.toggle("canvas-edge-active", active)
      if (text) {
        animateGlow(text, "--canvas-edge-label-glow", active)
        text.classList.toggle("canvas-edge-label-active", active)
      }
      if (fromElement && fromElement.dataset.nodeType !== "group") {
        animateGlow(fromElement, "--canvas-node-glow", active)
        fromElement.classList.toggle("canvas-node-active", active)
      }
      if (toElement && toElement.dataset.nodeType !== "group") {
        animateGlow(toElement, "--canvas-node-glow", active)
        toElement.classList.toggle("canvas-node-active", active)
      }
    }

    const activate = () => toggleActive(true)
    const deactivate = () => toggleActive(false)
    const flash = () => {
      activate()
      pulseGlow(path, "--canvas-edge-glow", 1.22, EDGE_FLASH_DURATION)
      if (text) {
        pulseGlow(text, "--canvas-edge-label-glow", 1.12, EDGE_FLASH_DURATION)
      }
      if (fromElement && fromElement.dataset.nodeType !== "group") {
        pulseGlow(fromElement, "--canvas-node-ping", 1.18, EDGE_FLASH_DURATION)
      }
      if (toElement && toElement.dataset.nodeType !== "group") {
        pulseGlow(toElement, "--canvas-node-ping", 1.18, EDGE_FLASH_DURATION)
      }
      window.setTimeout(() => deactivate(), EDGE_FLASH_DURATION)
    }

    path.addEventListener("pointerenter", activate)
    path.addEventListener("pointerleave", deactivate)
    path.addEventListener("focus", activate)
    path.addEventListener("blur", deactivate)
    path.addEventListener("pointerup", flash)
    path.addEventListener("click", flash)
    path.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        flash()
      }
    })

    edgeElements.set(edgeId, {
      id: edgeId,
      path,
      label: text,
      from: edge.fromNode,
      to: edge.toNode,
    })
  })

  return { elements: edgeElements, byNode: edgesByNode }
}

function setupInteractions(viewer: HTMLElement, state: ViewerState): InteractionControls {
  const viewport = viewer.querySelector<HTMLDivElement>(".canvas-viewport")
  const inner = viewer.querySelector<HTMLDivElement>(".canvas-inner")
  if (!viewport || !inner) {
    return {
      cleanup: () => {},
      applyTransform: () => {},
      focusCanvasPoint: () => {},
      state,
    }
  }

  let isPanning = false
  let startX = 0
  let startY = 0
  let startTranslateX = 0
  let startTranslateY = 0

  const activeTouches = new Map<number, Point>()
  let touchDistance: number | null = null
  let touchCenter: Point | null = null
  let pinchVelocity = 0
  let pinchMomentumFrame: number | null = null
  let pinchMomentumCenter: Point | null = null
  let pinchActive = false

  const applyTransform = () => {
    inner.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`
    viewer.dataset["scale"] = state.scale.toFixed(2)
    viewer.dataset["translate"] = `${state.translateX},${state.translateY}`
  }

  const withAnimatedTransform = (callback: () => void, animate: boolean) => {
    if (animate) {
      inner.style.transition = "transform 220ms ease"
    }
    callback()
    if (animate) {
      window.setTimeout(() => {
        inner.style.transition = ""
      }, 240)
    }
  }

  const updateTranslationBounds = () => {
    const rect = viewport.getBoundingClientRect()
    const minTranslateX = rect.width - state.width * state.scale
    const minTranslateY = rect.height - state.height * state.scale
    state.translateX = clamp(state.translateX, minTranslateX, 0)
    state.translateY = clamp(state.translateY, minTranslateY, 0)
  }

  const zoomAroundPoint = (clientX: number, clientY: number, deltaScale: number) => {
    const rect = viewport.getBoundingClientRect()
    const offsetX = (clientX - rect.left - state.translateX) / state.scale
    const offsetY = (clientY - rect.top - state.translateY) / state.scale

    const nextScale = clamp(state.scale * deltaScale, state.minScale, state.maxScale)
    state.scale = nextScale
    state.translateX = clientX - rect.left - offsetX * state.scale
    state.translateY = clientY - rect.top - offsetY * state.scale
    updateTranslationBounds()
    applyTransform()
    viewport.dataset["panning"] = "false"
  }

  const stopPinchMomentum = () => {
    if (pinchMomentumFrame !== null) {
      window.cancelAnimationFrame(pinchMomentumFrame)
      pinchMomentumFrame = null
    }
  }

  const startPinchMomentum = () => {
    if (!pinchMomentumCenter) {
      return
    }
    stopPinchMomentum()
    const run = () => {
      pinchVelocity *= 0.82
      if (Math.abs(pinchVelocity) <= 0.002) {
        pinchMomentumFrame = null
        pinchVelocity = 0
        return
      }
      const factor = clamp(1 + pinchVelocity, 0.75, 1.25)
      zoomAroundPoint(pinchMomentumCenter!.x, pinchMomentumCenter!.y, factor)
      pinchMomentumFrame = window.requestAnimationFrame(run)
    }
    pinchMomentumFrame = window.requestAnimationFrame(run)
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return
    }
    const target = event.target as HTMLElement | null
    if (target?.closest("a, button, input, textarea")) {
      return
    }

    stopPinchMomentum()
    if (event.pointerType === "touch") {
      activeTouches.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (activeTouches.size === 2) {
        const touches = Array.from(activeTouches.values())
        const dx = touches[1].x - touches[0].x
        const dy = touches[1].y - touches[0].y
        touchDistance = Math.hypot(dx, dy)
        touchCenter = { x: touches[0].x + dx / 2, y: touches[0].y + dy / 2 }
        pinchActive = true
        pinchMomentumCenter = touchCenter
        isPanning = false
      } else if (activeTouches.size === 1) {
        isPanning = true
        startX = event.clientX
        startY = event.clientY
        startTranslateX = state.translateX
        startTranslateY = state.translateY
      }
    } else {
      isPanning = true
      startX = event.clientX
      startY = event.clientY
      startTranslateX = state.translateX
      startTranslateY = state.translateY
    }

    viewport.setPointerCapture(event.pointerId)
    viewport.dataset["panning"] = isPanning ? "true" : "false"
    event.preventDefault()
  }

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === "touch") {
      if (!activeTouches.has(event.pointerId)) {
        return
      }
      activeTouches.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (activeTouches.size === 2) {
        const touches = Array.from(activeTouches.values())
        const dx = touches[1].x - touches[0].x
        const dy = touches[1].y - touches[0].y
        const newDistance = Math.hypot(dx, dy)
        const center = { x: touches[0].x + dx / 2, y: touches[0].y + dy / 2 }
        if (touchDistance && touchDistance > 0) {
          const deltaRatio = newDistance / touchDistance
          pinchVelocity = (deltaRatio - 1) * 0.65
          const factor = clamp(1 + pinchVelocity, 0.75, 1.25)
          pinchMomentumCenter = center
          zoomAroundPoint(center.x, center.y, factor)
        }
        if (touchCenter) {
          const rect = viewport.getBoundingClientRect()
          const minTranslateX = rect.width - state.width * state.scale
          const minTranslateY = rect.height - state.height * state.scale
          const deltaX = center.x - touchCenter.x
          const deltaY = center.y - touchCenter.y
          state.translateX = clamp(state.translateX + deltaX, minTranslateX, 0)
          state.translateY = clamp(state.translateY + deltaY, minTranslateY, 0)
          applyTransform()
        }
        touchDistance = newDistance
        touchCenter = center
        pinchActive = true
      } else if (isPanning) {
        const dx = event.clientX - startX
        const dy = event.clientY - startY
        const rect = viewport.getBoundingClientRect()
        state.translateX = clamp(startTranslateX + dx, rect.width - state.width * state.scale, 0)
        state.translateY = clamp(startTranslateY + dy, rect.height - state.height * state.scale, 0)
        applyTransform()
      }
      return
    }

    if (!isPanning) {
      return
    }
    const dx = event.clientX - startX
    const dy = event.clientY - startY
    const rect = viewport.getBoundingClientRect()
    state.translateX = clamp(startTranslateX + dx, rect.width - state.width * state.scale, 0)
    state.translateY = clamp(startTranslateY + dy, rect.height - state.height * state.scale, 0)
    applyTransform()
  }

  const endPan = (event: PointerEvent) => {
    let shouldStartMomentum = false
    if (event.pointerType === "touch") {
      activeTouches.delete(event.pointerId)
      if (activeTouches.size < 2) {
        shouldStartMomentum = pinchActive && Math.abs(pinchVelocity) > 0.001
        pinchActive = false
        touchDistance = null
        touchCenter = null
      }
    }
    if (viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId)
    }
    if (!isPanning) {
      viewport.dataset["panning"] = "false"
      if (shouldStartMomentum) {
        startPinchMomentum()
      }
      return
    }
    isPanning = false
    viewport.dataset["panning"] = "false"
    if (shouldStartMomentum) {
      startPinchMomentum()
    }
  }

  const onPointerLeave = () => {
    if (!isPanning) return
    isPanning = false
    viewport.dataset["panning"] = "false"
  }

  viewport.addEventListener("pointerdown", onPointerDown)
  viewport.addEventListener("pointermove", onPointerMove)
  viewport.addEventListener("pointerup", endPan)
  viewport.addEventListener("pointercancel", endPan)
  viewport.addEventListener("pointerleave", onPointerLeave)

  const onWheel = (event: WheelEvent) => {
    event.preventDefault()
    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9
    zoomAroundPoint(event.clientX, event.clientY, zoomFactor)
  }

  viewport.addEventListener("wheel", onWheel, { passive: false })

  const additionalCleanup: Array<() => void> = []
  let savedTransform: { scale: number; translateX: number; translateY: number } | null = null
  let wasFullscreen = false

  const fullscreenButton = viewer.querySelector<HTMLButtonElement>(".canvas-button[data-action='fullscreen']")

  const getFullscreenElement = (): Element | null => {
    const doc = document as FullscreenDocument
    return document.fullscreenElement ?? doc.webkitFullscreenElement ?? doc.msFullscreenElement ?? null
  }

  const requestFullscreen = (element: HTMLElement) => {
    const target = element as FullscreenElement
    if (target.requestFullscreen) {
      return target.requestFullscreen()
    }
    if (target.webkitRequestFullscreen) {
      return target.webkitRequestFullscreen()
    }
    if (target.msRequestFullscreen) {
      return target.msRequestFullscreen()
    }
    return Promise.resolve()
  }

  const exitFullscreen = () => {
    const doc = document as FullscreenDocument
    if (document.exitFullscreen) {
      return document.exitFullscreen()
    }
    if (doc.webkitExitFullscreen) {
      return doc.webkitExitFullscreen()
    }
    if (doc.msExitFullscreen) {
      return doc.msExitFullscreen()
    }
    return Promise.resolve()
  }

  const updateFullscreenState = () => {
    const isFullscreen = getFullscreenElement() === viewer
    viewer.dataset.fullscreen = isFullscreen ? "true" : "false"
    if (isFullscreen && !wasFullscreen) {
      savedTransform = { scale: state.scale, translateX: state.translateX, translateY: state.translateY }
      const rect = viewport.getBoundingClientRect()
      const fitScale = Math.min(rect.width / state.width, rect.height / state.height)
      if (Number.isFinite(fitScale) && fitScale > 0) {
        state.scale = clamp(fitScale, state.minScale, state.maxScale)
        state.translateX = (rect.width - state.width * state.scale) / 2
        state.translateY = (rect.height - state.height * state.scale) / 2
      }
      updateTranslationBounds()
      applyTransform()
    } else if (!isFullscreen && wasFullscreen) {
      if (savedTransform) {
        state.scale = clamp(savedTransform.scale, state.minScale, state.maxScale)
        state.translateX = savedTransform.translateX
        state.translateY = savedTransform.translateY
        savedTransform = null
      }
      updateTranslationBounds()
      applyTransform()
    }
    wasFullscreen = isFullscreen
    if (!fullscreenButton) return
    fullscreenButton.setAttribute("aria-pressed", isFullscreen ? "true" : "false")
    const labelKey = isFullscreen ? "tooltipExit" : "tooltipEnter"
    const textKey = isFullscreen ? "labelExit" : "labelEnter"
    const tooltip = fullscreenButton.dataset[labelKey]
    const label = fullscreenButton.dataset[textKey]
    if (label) {
      fullscreenButton.textContent = label
    }
    if (tooltip) {
      fullscreenButton.setAttribute("aria-label", tooltip)
      fullscreenButton.title = tooltip
    }
  }

  let canUseFullscreen = false

  if (fullscreenButton) {
    const target = viewer as FullscreenElement
    canUseFullscreen =
      typeof target.requestFullscreen === "function" ||
      typeof target.webkitRequestFullscreen === "function" ||
      typeof target.msRequestFullscreen === "function"

    const fullscreenEnabled = document.fullscreenEnabled ?? true

    if (!canUseFullscreen || !fullscreenEnabled) {
      fullscreenButton.dataset.unavailable = "true"
      fullscreenButton.disabled = true
    } else {
      updateFullscreenState()
      const onFullscreenChange = () => updateFullscreenState()
      document.addEventListener("fullscreenchange", onFullscreenChange)
      document.addEventListener("webkitfullscreenchange", onFullscreenChange as EventListener)
      document.addEventListener("MSFullscreenChange", onFullscreenChange as EventListener)
      additionalCleanup.push(() => {
        document.removeEventListener("fullscreenchange", onFullscreenChange)
        document.removeEventListener("webkitfullscreenchange", onFullscreenChange as EventListener)
        document.removeEventListener("MSFullscreenChange", onFullscreenChange as EventListener)
      })
      additionalCleanup.push(() => {
        if (getFullscreenElement() === viewer) {
          Promise.resolve(exitFullscreen()).catch(() => {})
        }
      })
    }
  }

  const updateScale = (factor: number) => {
    const rect = viewport.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    zoomAroundPoint(centerX, centerY, factor)
  }

  const buttonHandlers: Array<() => void> = []
  viewer.querySelectorAll<HTMLButtonElement>(".canvas-button").forEach((button) => {
    const onClick = () => {
      const action = button.dataset["action"]
      switch (action) {
        case "zoom-in":
          updateScale(1.1)
          break
        case "zoom-out":
          updateScale(0.9)
          break
        case "fit": {
          const rect = viewport.getBoundingClientRect()
          const fitScale = Math.min(rect.width / state.width, rect.height / state.height)
          state.scale = clamp(fitScale, state.minScale, state.maxScale)
          state.translateX = (rect.width - state.width * state.scale) / 2
          state.translateY = (rect.height - state.height * state.scale) / 2
          applyTransform()
          break
        }
        case "fullscreen":
          if (!canUseFullscreen) {
            break
          }
          if (getFullscreenElement() === viewer) {
            Promise.resolve(exitFullscreen()).catch(() => {})
          } else {
            Promise.resolve(requestFullscreen(viewer)).catch(() => {})
          }
          break
        case "reset":
        default: {
          state.scale = 1
          state.translateX = 0
          state.translateY = 0
          applyTransform()
        }
      }
    }

    button.addEventListener("click", onClick)
    buttonHandlers.push(() => button.removeEventListener("click", onClick))
  })

  const resizeObserver = new ResizeObserver(() => {
    const rect = viewport.getBoundingClientRect()
    const scaleX = rect.width / state.width
    const scaleY = rect.height / state.height
    const bestFit = clamp(Math.min(scaleX, scaleY), state.minScale, state.maxScale)
    if (Number.isFinite(bestFit) && bestFit > 0) {
      state.scale = Math.min(state.maxScale, Math.max(state.minScale, bestFit))
    }
    updateTranslationBounds()
    applyTransform()
  })
  resizeObserver.observe(viewport)

  const focusCanvasPoint = (point: Point, options?: { animate?: boolean; minScale?: number }) => {
    const rect = viewport.getBoundingClientRect()
    if (options?.minScale && options.minScale > state.scale) {
      state.scale = clamp(options.minScale, state.minScale, state.maxScale)
    }
    const centerX = rect.width / 2 - point.x * state.scale
    const centerY = rect.height / 2 - point.y * state.scale
    const minTranslateX = rect.width - state.width * state.scale
    const minTranslateY = rect.height - state.height * state.scale
    state.translateX = clamp(centerX, minTranslateX, 0)
    state.translateY = clamp(centerY, minTranslateY, 0)
    withAnimatedTransform(() => applyTransform(), options?.animate ?? true)
  }

  return {
    cleanup: () => {
      viewport.removeEventListener("pointerdown", onPointerDown)
      viewport.removeEventListener("pointermove", onPointerMove)
      viewport.removeEventListener("pointerup", endPan)
      viewport.removeEventListener("pointercancel", endPan)
      viewport.removeEventListener("pointerleave", onPointerLeave)
      viewport.removeEventListener("wheel", onWheel)
      buttonHandlers.forEach((cleanup) => cleanup())
      resizeObserver.disconnect()
      additionalCleanup.forEach((cleanup) => cleanup())
      if (pinchMomentumFrame !== null) {
        window.cancelAnimationFrame(pinchMomentumFrame)
      }
    },
    applyTransform,
    focusCanvasPoint,
    state,
  }
}

function initialiseViewer(viewer: HTMLElement) {
  if (viewer.dataset.canvasInitialised === "true") {
    return
  }
  const script = viewer.querySelector<HTMLScriptElement>("script[data-canvas]")
  const nodesContainer = viewer.querySelector<HTMLDivElement>(".canvas-nodes")
  const svg = viewer.querySelector<SVGSVGElement>(".canvas-edges")
  if (!script || !script.textContent || !nodesContainer || !svg) return

  const viewerCleanup: Cleanup[] = []
  let data: CanvasData
  try {
    data = JSON.parse(script.textContent) as CanvasData
  } catch (error) {
    console.error("Quartz: Failed to parse canvas data", error)
    return
  }

  const nodes = data.nodes ?? []
  const edges = data.edges ?? []
  if (nodes.length === 0) {
    viewer.classList.add("canvas-empty")
    return
  }

  const minX = Math.min(...nodes.map((n) => n.x))
  const minY = Math.min(...nodes.map((n) => n.y))
  const maxX = Math.max(...nodes.map((n) => n.x + n.width))
  const maxY = Math.max(...nodes.map((n) => n.y + n.height))
  const offset: Point = { x: minX, y: minY }
  const width = Math.max(maxX - minX, 1)
  const height = Math.max(maxY - minY, 1)

  const nodeMap = new Map<string, CanvasNode>()
  const nodeElements = new Map<string, HTMLDivElement>()
  const wikiLinks: WikiLinkRecord[] = []

  const registerWikiLink = (record: WikiLinkRecord) => {
    wikiLinks.push(record)
  }

  nodesContainer.innerHTML = ""
  nodes.forEach((node) => {
    const element = createNodeElement(node, offset, registerWikiLink)
    element.dataset.nodeType = node.type
    nodesContainer.append(element)
    nodeMap.set(node.id, node)
    nodeElements.set(node.id, element)
  })

  const inner = viewer.querySelector<HTMLDivElement>(".canvas-inner")
  if (!inner) return
  inner.style.width = `${width}px`
  inner.style.height = `${height}px`
  nodesContainer.style.width = `${width}px`
  nodesContainer.style.height = `${height}px`
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`)
  svg.setAttribute("width", width.toString())
  svg.setAttribute("height", height.toString())
  const { elements: edgeElements, byNode: edgesByNode } = renderEdges(svg, nodeMap, edges, offset, nodeElements)

  const highlightNodeEdges = (nodeId: string, active: boolean) => {
    const element = nodeElements.get(nodeId)
    if (!element) {
      return
    }
    const nodeType = element.dataset.nodeType
    if (nodeType !== "group") {
      element.classList.toggle("canvas-node-active", active)
      animateGlow(element, "--canvas-node-glow", active)
    }
    const edgeIds = edgesByNode.get(nodeId)
    if (!edgeIds) {
      return
    }
    edgeIds.forEach((edgeId) => {
      const record = edgeElements.get(edgeId)
      if (!record) return
      record.path.classList.toggle("canvas-edge-active", active)
      animateGlow(record.path, "--canvas-edge-glow", active)
      if (record.label) {
        record.label.classList.toggle("canvas-edge-label-active", active)
        animateGlow(record.label, "--canvas-edge-label-glow", active)
      }
      const otherId = record.from === nodeId ? record.to : record.from
      if (otherId !== nodeId) {
        const otherNode = nodeElements.get(otherId)
        if (otherNode && otherNode.dataset.nodeType !== "group") {
          otherNode.classList.toggle("canvas-node-connected", active)
          animateGlow(otherNode, "--canvas-node-glow", active)
        }
      }
    })
  }

  nodeElements.forEach((element, nodeId) => {
    const nodeType = element.dataset.nodeType
    if (nodeType === "group") {
      return
    }
    const activate = () => highlightNodeEdges(nodeId, true)
    const deactivate = () => highlightNodeEdges(nodeId, false)
    element.addEventListener("pointerenter", activate)
    element.addEventListener("pointerleave", deactivate)
    element.addEventListener("focus", activate)
    element.addEventListener("blur", deactivate)
    element.addEventListener("pointerdown", (event) => {
      if ((event.target as HTMLElement | null)?.closest("a, button")) {
        return
      }
      highlightNodeEdges(nodeId, true)
      pulseGlow(element, "--canvas-node-ping", 1.2, NODE_FLASH_DURATION)
    })
    element.addEventListener("pointerup", () => highlightNodeEdges(nodeId, false))
    element.addEventListener("pointercancel", () => highlightNodeEdges(nodeId, false))
  })

  const state: ViewerState = {
    scale: 1,
    translateX: 0,
    translateY: 0,
    minScale: 0.2,
    maxScale: 3,
    width,
    height,
  }

  const viewport = viewer.querySelector<HTMLDivElement>(".canvas-viewport")
  if (viewport) {
    const rect = viewport.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      const fitScale = clamp(Math.min(rect.width / width, rect.height / height), state.minScale, state.maxScale)
      if (Number.isFinite(fitScale) && fitScale > 0) {
        state.scale = fitScale
        state.translateX = (rect.width - width * state.scale) / 2
        state.translateY = (rect.height - height * state.scale) / 2
      }
    }
  }

  const interactions = setupInteractions(viewer, state)
  interactions.applyTransform()
  viewerCleanup.push(() => interactions.cleanup())

  const focusNode = (nodeId: string, options?: { animate?: boolean; minScale?: number }) => {
    const node = nodeMap.get(nodeId)
    const element = nodeElements.get(nodeId)
    if (!node || !element) {
      return
    }
    const point: Point = {
      x: node.x - offset.x + node.width / 2,
      y: node.y - offset.y + node.height / 2,
    }
    interactions.focusCanvasPoint(point, options)
    element.classList.add("canvas-node-flash")
    highlightNodeEdges(nodeId, true)
    pulseGlow(element, "--canvas-node-ping", 1.35, NODE_FLASH_DURATION + 120)
    animateGlow(element, "--canvas-node-glow", true)
    window.setTimeout(() => {
      element.classList.remove("canvas-node-flash")
      scheduleIdle(() => {
        highlightNodeEdges(nodeId, false)
        animateGlow(element, "--canvas-node-glow", false)
      })
    }, NODE_FLASH_DURATION)
  }

  const targetMap = new Map<string, string>()
  const registerTarget = (value: string | null | undefined, nodeId: string) => {
    const key = normaliseKey(value)
    if (!key || targetMap.has(key)) {
      return
    }
    targetMap.set(key, nodeId)
  }

  nodes.forEach((node) => {
    registerTarget(node.id, node.id)
    registerTarget(node.label, node.id)
    if (node.text) {
      const firstLine = node.text.split(/\r?\n/)[0]
      registerTarget(firstLine, node.id)
    }
    if (node.file?.path) {
      registerTarget(node.file.path, node.id)
    }
  })

  const updateHistoryForNode = (nodeId: string, mode: "push" | "replace" = "push") => {
    if (typeof window === "undefined") {
      return
    }
    try {
      const slug = encodeURIComponent(nodeId)
      const { pathname, search } = window.location
      const newUrl = `${pathname}${search}#canvas-${slug}`
      if (mode === "push" && typeof window.history.pushState === "function") {
        window.history.pushState({ canvasNode: nodeId }, "", newUrl)
      } else if (typeof window.history.replaceState === "function") {
        window.history.replaceState({ canvasNode: nodeId }, "", newUrl)
      } else {
        window.location.hash = `canvas-${slug}`
      }
    } catch (error) {
      console.warn("Quartz: Failed to update canvas history", error)
    }
  }

  const applyHashFocus = (mode: "replace" | "push" = "replace") => {
    if (typeof window === "undefined") {
      return
    }
    const rawHash = window.location.hash
    if (!rawHash.startsWith("#canvas-")) {
      return
    }
    const rawValue = decodeURIComponent(rawHash.slice("#canvas-".length))
    if (nodeMap.has(rawValue)) {
      focusNode(rawValue, { animate: mode !== "replace", minScale: 0.6 })
      return
    }
    const normalised = normaliseKey(rawValue)
    if (!normalised) {
      return
    }
    const mapped = targetMap.get(normalised)
    if (mapped) {
      focusNode(mapped, { animate: mode !== "replace", minScale: 0.6 })
    }
  }

  wikiLinks.forEach((record) => {
    const targetId = targetMap.get(record.target)
    if (!targetId) {
      record.element.classList.add("canvas-wikilink-unresolved")
      record.element.disabled = true
      return
    }
    record.element.dataset.targetId = targetId
    const triggerFocus = () => {
      focusNode(targetId, { animate: true, minScale: 0.6 })
      updateHistoryForNode(targetId, "push")
    }
    record.element.addEventListener("click", triggerFocus)
    record.element.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        triggerFocus()
      }
    })
  })

  if (typeof window !== "undefined") {
    applyHashFocus("replace")
    const onPopState = () => applyHashFocus("replace")
    const onHashChange = () => applyHashFocus("replace")
    window.addEventListener("popstate", onPopState)
    window.addEventListener("hashchange", onHashChange)
    viewerCleanup.push(() => {
      window.removeEventListener("popstate", onPopState)
      window.removeEventListener("hashchange", onHashChange)
    })
  }

  viewer.dataset["loaded"] = "true"
  viewer.dataset.canvasInitialised = "true"

  if (typeof window !== "undefined" && typeof window.addCleanup === "function") {
    window.addCleanup(() => {
      viewerCleanup.forEach((cleanup) => cleanup())
      viewer.dataset.canvasInitialised = "false"
      viewer.dataset["loaded"] = "false"
    })
  }
}

function setupCanvas(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>(".canvas-viewer").forEach((viewer) => {
    initialiseViewer(viewer)
  })
}

setupCanvas()

document.addEventListener("nav", () => {
  requestAnimationFrame(() => setupCanvas())
})
