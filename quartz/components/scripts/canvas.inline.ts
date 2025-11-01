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
  fitToViewport: (options?: { animate?: boolean }) => void
  state: ViewerState
}

const WIKILINK_PATTERN = /\[\[([^\]]+)\]\]/g
const NODE_FLASH_DURATION = 640
const EDGE_PING_DURATION = 520
const LONG_PRESS_DURATION = 450
const DOUBLE_TAP_INTERVAL = 320
const DOUBLE_TAP_DISTANCE = 28

type GlowController = {
  flash: (element: Element | null | undefined, className: string, duration: number) => void
  toggle: (element: Element | null | undefined, className: string, active: boolean) => void
  cancel: (element: Element | null | undefined, className: string) => void
  prune: () => void
}

const now = (): number => {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now()
  }
  return Date.now()
}

const scheduleFrame = (callback: (time: number) => void): number => {
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    return window.requestAnimationFrame((time) => callback(time))
  }
  return setTimeout(() => callback(now()), 16)
}

const cancelFrame = (handle: number | null | undefined) => {
  if (handle == null) {
    return
  }
  if (typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
    window.cancelAnimationFrame(handle)
  } else {
    clearTimeout(handle)
  }
}

const scheduleIdle = (callback: () => void) => {
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    const idle = window.requestIdleCallback as unknown as (cb: () => void) => number
    idle(() => callback())
    return
  }
  setTimeout(callback, 48)
}

const createGlowController = (): GlowController => {
  const entries = new Map<Element, Map<string, number>>()
  let scheduled = false

  const ensureScheduled = () => {
    if (scheduled) return
    scheduled = true
    scheduleFrame(step)
  }

  const step = (time: number) => {
    entries.forEach((classMap, element) => {
      classMap.forEach((expiry, className) => {
        if (time >= expiry) {
          element.classList.remove(className)
          classMap.delete(className)
        }
      })
      if (classMap.size === 0) {
        entries.delete(element)
      }
    })

    if (entries.size > 0) {
      scheduleFrame(step)
    } else {
      scheduled = false
    }
  }

  const register = (element: Element, className: string, duration: number) => {
    const expiry = now() + duration
    let classMap = entries.get(element)
    if (!classMap) {
      classMap = new Map<string, number>()
      entries.set(element, classMap)
    }
    classMap.set(className, expiry)
    ensureScheduled()
  }

  const clear = (element: Element, className?: string) => {
    const classMap = entries.get(element)
    if (!classMap) {
      return
    }
    if (className) {
      classMap.delete(className)
    } else {
      classMap.clear()
    }
    if (classMap.size === 0) {
      entries.delete(element)
    }
  }

  return {
    flash: (element, className, duration) => {
      if (!element) return
      element.classList.add(className)
      register(element, className, duration)
    },
    toggle: (element, className, active) => {
      if (!element) return
      if (active) {
        element.classList.add(className)
      } else {
        element.classList.remove(className)
        clear(element, className)
      }
    },
    cancel: (element, className) => {
      if (!element) return
      element.classList.remove(className)
      clear(element, className)
    },
    prune: () => {
      const current = now()
      entries.forEach((classMap, element) => {
        classMap.forEach((expiry, className) => {
          if (current >= expiry) {
            element.classList.remove(className)
            classMap.delete(className)
          }
        })
        if (classMap.size === 0) {
          entries.delete(element)
        }
      })
      if (entries.size === 0) {
        scheduled = false
      }
    },
  }
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
  glow: GlowController,
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
      group.append(text)
    }

    const fromElement = nodeElements.get(edge.fromNode)
    const toElement = nodeElements.get(edge.toNode)

    const toggleNodeClass = (
      element: HTMLDivElement | undefined,
      className: string,
      active: boolean,
    ) => {
      if (!element || element.dataset.nodeType === "group") {
        return
      }
      glow.toggle(element, className, active)
    }

    const pingNode = (element: HTMLDivElement | undefined) => {
      if (!element || element.dataset.nodeType === "group") {
        return
      }
      glow.flash(element, "canvas-node-ping", NODE_FLASH_DURATION)
    }

    const toggleActive = (active: boolean) => {
      glow.toggle(path, "canvas-edge-active", active)
      if (text) {
        glow.toggle(text, "canvas-edge-label-active", active)
      }
      toggleNodeClass(fromElement, "canvas-node-active", active)
      toggleNodeClass(toElement, "canvas-node-active", active)
    }

    const pingEdge = () => {
      glow.flash(path, "canvas-edge-ping", EDGE_PING_DURATION)
      if (text) {
        glow.flash(text, "canvas-edge-ping", EDGE_PING_DURATION)
      }
      pingNode(fromElement)
      pingNode(toElement)
    }

    const activate = () => {
      toggleActive(true)
      pingEdge()
    }

    const deactivate = () => toggleActive(false)

    const flash = () => {
      pingEdge()
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
  const overlay = viewer.querySelector<HTMLDivElement>(".canvas-overlay")
  let fullscreenBaseline: { scale: number; translateX: number; translateY: number } | null = null
  if (!viewport || !inner) {
    return {
      cleanup: () => {},
      applyTransform: () => {},
      focusCanvasPoint: () => {},
      fitToViewport: () => {},
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
  let pinchRaf: number | null = null
  let pinchLastCenter: Point | null = null
  let lastTapTime = 0
  let lastTapPoint: Point | null = null

  const stopPinchMomentum = () => {
    if (pinchRaf !== null) {
      cancelFrame(pinchRaf)
      pinchRaf = null
    }
    pinchVelocity = 0
  }

  const applyTransform = () => {
    inner.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`
    viewer.dataset["scale"] = state.scale.toFixed(2)
    viewer.dataset["translate"] = `${state.translateX},${state.translateY}`
    viewer.style.setProperty("--canvas-scale", state.scale.toFixed(3))
    viewer.style.setProperty("--canvas-pan-x", `${state.translateX}`)
    viewer.style.setProperty("--canvas-pan-y", `${state.translateY}`)
  }

  const withAnimatedTransform = (callback: () => void, animate: boolean) => {
    if (animate) {
      inner.style.transition = "transform 220ms ease"
    }
    callback()
    if (animate) {
      setTimeout(() => {
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

  const fitToViewport = (options?: { animate?: boolean }) => {
    const rect = viewport.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) {
      return
    }
    const fitScale = clamp(
      Math.min(rect.width / state.width, rect.height / state.height),
      state.minScale,
      state.maxScale,
    )
    if (!Number.isFinite(fitScale) || fitScale <= 0) {
      return
    }
    const translateX = (rect.width - state.width * fitScale) / 2
    const translateY = (rect.height - state.height * fitScale) / 2
    withAnimatedTransform(() => {
      state.scale = fitScale
      state.translateX = translateX
      state.translateY = translateY
      applyTransform()
    }, options?.animate ?? true)
  }

  const continuePinchMomentum = () => {
    if (!pinchLastCenter) {
      pinchRaf = null
      pinchVelocity = 0
      return
    }
    pinchVelocity *= 0.88
    if (Math.abs(pinchVelocity) < 0.0015) {
      pinchVelocity = 0
      pinchRaf = null
      return
    }
    zoomAroundPoint(pinchLastCenter.x, pinchLastCenter.y, 1 + pinchVelocity)
    pinchRaf = scheduleFrame(continuePinchMomentum)
  }

  const startPinchMomentum = () => {
    if (!pinchLastCenter) {
      return
    }
    if (pinchRaf !== null) {
      cancelFrame(pinchRaf)
    }
    pinchRaf = scheduleFrame(continuePinchMomentum)
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return
    }
    const target = event.target as HTMLElement | null
    if (target?.closest("a, button, input, textarea")) {
      return
    }

    viewer.dispatchEvent(new CustomEvent("canvas:interaction"))

    if (event.pointerType === "touch" && activeTouches.size === 0) {
      const currentTime = now()
      if (currentTime - lastTapTime < DOUBLE_TAP_INTERVAL && lastTapPoint) {
        const dx = event.clientX - lastTapPoint.x
        const dy = event.clientY - lastTapPoint.y
        if (dx * dx + dy * dy <= DOUBLE_TAP_DISTANCE * DOUBLE_TAP_DISTANCE) {
          lastTapTime = 0
          lastTapPoint = null
          stopPinchMomentum()
          viewer.dispatchEvent(
            new CustomEvent("canvas:dbltap", { detail: { x: event.clientX, y: event.clientY } }),
          )
          event.preventDefault()
          return
        }
      }
      lastTapTime = currentTime
      lastTapPoint = { x: event.clientX, y: event.clientY }
    } else if (event.pointerType !== "touch") {
      lastTapTime = 0
      lastTapPoint = null
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
          const deltaScale = newDistance / touchDistance
          zoomAroundPoint(center.x, center.y, deltaScale)
          const delta = deltaScale - 1
          pinchVelocity = pinchVelocity * 0.45 + delta * 0.55
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
        pinchLastCenter = { ...center }
      } else {
        pinchVelocity = 0
        if (isPanning) {
          const dx = event.clientX - startX
          const dy = event.clientY - startY
          const rect = viewport.getBoundingClientRect()
          state.translateX = clamp(startTranslateX + dx, rect.width - state.width * state.scale, 0)
          state.translateY = clamp(
            startTranslateY + dy,
            rect.height - state.height * state.scale,
            0,
          )
          applyTransform()
        }
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
    if (event.pointerType === "touch") {
      const previousCenter = touchCenter
      activeTouches.delete(event.pointerId)
      if (activeTouches.size < 2) {
        touchDistance = null
        touchCenter = null
        if (previousCenter) {
          pinchLastCenter = { ...previousCenter }
        }
        if (Math.abs(pinchVelocity) > 0.0015) {
          startPinchMomentum()
        } else {
          stopPinchMomentum()
        }
      }
    }
    if (viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId)
    }
    if (!isPanning) {
      viewport.dataset["panning"] = "false"
      return
    }
    isPanning = false
    viewport.dataset["panning"] = "false"
  }

  const onPointerLeave = () => {
    if (!isPanning) return
    isPanning = false
    viewport.dataset["panning"] = "false"
    stopPinchMomentum()
  }

  viewport.addEventListener("pointerdown", onPointerDown)
  viewport.addEventListener("pointermove", onPointerMove)
  viewport.addEventListener("pointerup", endPan)
  viewport.addEventListener("pointercancel", endPan)
  viewport.addEventListener("pointerleave", onPointerLeave)

  const onWheel = (event: WheelEvent) => {
    event.preventDefault()
    stopPinchMomentum()
    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9
    zoomAroundPoint(event.clientX, event.clientY, zoomFactor)
  }

  viewport.addEventListener("wheel", onWheel, { passive: false })

  const additionalCleanup: Array<() => void> = []

  const fullscreenButton = viewer.querySelector<HTMLButtonElement>(
    ".canvas-button[data-action='fullscreen']",
  )

  const getFullscreenElement = (): Element | null => {
    const doc = document as FullscreenDocument
    return (
      document.fullscreenElement ?? doc.webkitFullscreenElement ?? doc.msFullscreenElement ?? null
    )
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
    if (overlay) {
      overlay.dataset.fullscreen = isFullscreen ? "true" : "false"
    }
    stopPinchMomentum()
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
    const rect = viewport.getBoundingClientRect()
    if (isFullscreen) {
      if (!fullscreenBaseline) {
        fullscreenBaseline = {
          scale: state.scale,
          translateX: state.translateX,
          translateY: state.translateY,
        }
      }
      const fitScale = Math.min(rect.width / state.width, rect.height / state.height)
      if (Number.isFinite(fitScale) && fitScale > 0) {
        state.scale = clamp(fitScale, state.minScale, state.maxScale)
        state.translateX = (rect.width - state.width * state.scale) / 2
        state.translateY = (rect.height - state.height * state.scale) / 2
        updateTranslationBounds()
        applyTransform()
      }
    } else if (fullscreenBaseline) {
      state.scale = fullscreenBaseline.scale
      state.translateX = fullscreenBaseline.translateX
      state.translateY = fullscreenBaseline.translateY
      fullscreenBaseline = null
      updateTranslationBounds()
      applyTransform()
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
    stopPinchMomentum()
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
          fitToViewport({ animate: true })
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
          withAnimatedTransform(() => {
            state.scale = 1
            state.translateX = 0
            state.translateY = 0
            applyTransform()
          }, true)
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
      stopPinchMomentum()
      viewport.removeEventListener("pointerdown", onPointerDown)
      viewport.removeEventListener("pointermove", onPointerMove)
      viewport.removeEventListener("pointerup", endPan)
      viewport.removeEventListener("pointercancel", endPan)
      viewport.removeEventListener("pointerleave", onPointerLeave)
      viewport.removeEventListener("wheel", onWheel)
      buttonHandlers.forEach((cleanup) => cleanup())
      resizeObserver.disconnect()
      additionalCleanup.forEach((cleanup) => cleanup())
    },
    applyTransform,
    focusCanvasPoint,
    fitToViewport,
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
  const viewport = viewer.querySelector<HTMLDivElement>(".canvas-viewport")
  const overlay = viewer.querySelector<HTMLDivElement>(".canvas-overlay")
  const overlayPanel = overlay?.querySelector<HTMLDivElement>(".canvas-overlay-panel") ?? null
  if (!script || !script.textContent || !nodesContainer || !svg || !viewport) return

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
  const glow = createGlowController()
  const focusExpiry = new Map<string, number>()
  let activeNodeId: string | null = null
  const longPressTimers = new Map<number, number>()
  const pointerOrigins = new Map<number, Point>()
  const cancelLongPress = (pointerId: number) => {
    const timer = longPressTimers.get(pointerId)
    if (timer) {
      clearTimeout(timer)
      longPressTimers.delete(pointerId)
    }
  }

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
  const { elements: edgeElements, byNode: edgesByNode } = renderEdges(
    svg,
    nodeMap,
    edges,
    offset,
    nodeElements,
    glow,
  )

  const highlightNodeEdges = (nodeId: string, active: boolean, options?: { ping?: boolean }) => {
    const element = nodeElements.get(nodeId)
    if (element && element.dataset.nodeType !== "group") {
      glow.toggle(element, "canvas-node-active", active)
      if (options?.ping && active) {
        glow.flash(element, "canvas-node-ping", NODE_FLASH_DURATION)
      }
    }
    const edgeIds = edgesByNode.get(nodeId)
    if (!edgeIds) {
      return
    }
    edgeIds.forEach((edgeId) => {
      const record = edgeElements.get(edgeId)
      if (!record) return
      glow.toggle(record.path, "canvas-edge-active", active)
      if (record.label) {
        glow.toggle(record.label, "canvas-edge-label-active", active)
      }
      if (options?.ping && active) {
        glow.flash(record.path, "canvas-edge-ping", EDGE_PING_DURATION)
        if (record.label) {
          glow.flash(record.label, "canvas-edge-ping", EDGE_PING_DURATION)
        }
      }
      const otherId = record.from === nodeId ? record.to : record.from
      if (otherId !== nodeId) {
        const otherNode = nodeElements.get(otherId)
        if (otherNode && otherNode.dataset.nodeType !== "group") {
          glow.toggle(otherNode, "canvas-node-connected", active)
          if (options?.ping && active) {
            glow.flash(otherNode, "canvas-node-ping", NODE_FLASH_DURATION)
          }
        }
      }
    })
  }

  const closeMenu = () => {
    if (!overlay || !overlayPanel) {
      return
    }
    const activeId = overlayPanel.dataset.nodeId
    if (activeId) {
      const element = nodeElements.get(activeId)
      if (!element || (!element.matches(":hover") && element !== document.activeElement)) {
        highlightNodeEdges(activeId, false)
      }
    }
    overlay.dataset.menu = "false"
    overlayPanel.hidden = true
    overlayPanel.innerHTML = ""
    overlayPanel.removeAttribute("data-node-id")
    overlayPanel.style.removeProperty("--menu-left")
    overlayPanel.style.removeProperty("--menu-top")
  }

  const openMenu = (nodeId: string, point: Point) => {
    if (!overlay || !overlayPanel) {
      return
    }
    const node = nodeMap.get(nodeId)
    if (!node) {
      return
    }
    closeMenu()
    overlay.dataset.menu = "true"
    overlayPanel.hidden = false
    overlayPanel.dataset.nodeId = nodeId
    overlayPanel.tabIndex = -1
    activeNodeId = nodeId
    highlightNodeEdges(nodeId, true, { ping: true })
    const rect = viewport.getBoundingClientRect()
    const leftPercent = clamp(((point.x - rect.left) / rect.width) * 100, 8, 92)
    const topPercent = clamp(((point.y - rect.top) / rect.height) * 100, 6, 92)
    overlayPanel.style.setProperty("--menu-left", `${leftPercent}%`)
    overlayPanel.style.setProperty("--menu-top", `${topPercent}%`)
    overlayPanel.innerHTML = ""

    const title = document.createElement("p")
    title.className = "canvas-overlay-title"
    title.textContent = node.label ?? node.text?.split(/\r?\n/)[0] ?? node.id
    overlayPanel.append(title)

    const addButton = (label: string, handler: () => void) => {
      const button = document.createElement("button")
      button.type = "button"
      button.className = "canvas-overlay-item"
      button.textContent = label
      button.addEventListener("click", () => {
        handler()
        closeMenu()
      })
      overlayPanel.append(button)
    }

    addButton("Odağı bu karta getir", () => focusNode(nodeId, { animate: true, minScale: 0.85 }))

    if (node.file?.path) {
      addButton("Dosyayı aç", () => {
        if (typeof window !== "undefined") {
          window.location.href = node.file!.path!
        }
      })
    } else if (node.url) {
      addButton("Bağlantıyı aç", () => {
        if (typeof window !== "undefined") {
          window.open(node.url!, "_blank", "noopener,noreferrer")
        }
      })
    }

    addButton("Bağlantıları vurgula", () => {
      highlightNodeEdges(nodeId, true, { ping: true })
    })

    requestAnimationFrame(() => overlayPanel.focus({ preventScroll: true }))
  }

  if (overlay) {
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        closeMenu()
      }
    })
  }

  overlayPanel?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault()
      closeMenu()
    }
  })

  overlayPanel?.addEventListener("focusout", (event) => {
    if (!overlayPanel.contains(event.relatedTarget as Node)) {
      closeMenu()
    }
  })

  viewer.addEventListener("canvas:interaction", () => closeMenu())

  nodeElements.forEach((element, nodeId) => {
    const nodeType = element.dataset.nodeType
    if (nodeType === "group") {
      return
    }
    const activate = () => {
      activeNodeId = nodeId
      highlightNodeEdges(nodeId, true, { ping: true })
    }
    const deactivate = () => {
      if (focusExpiry.has(nodeId)) {
        return
      }
      highlightNodeEdges(nodeId, false)
    }
    element.addEventListener("pointerenter", activate)
    element.addEventListener("pointerleave", (event: PointerEvent) => {
      pointerOrigins.delete(event.pointerId)
      cancelLongPress(event.pointerId)
      deactivate()
    })
    element.addEventListener("focus", activate)
    element.addEventListener("blur", deactivate)
    element.addEventListener("pointermove", (event: PointerEvent) => {
      if (event.pointerType === "touch" || event.pointerType === "pen") {
        pointerOrigins.set(event.pointerId, { x: event.clientX, y: event.clientY })
      }
    })
    element.addEventListener("pointerdown", (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest("a, button, input, textarea")) {
        return
      }
      viewer.dispatchEvent(new CustomEvent("canvas:interaction"))
      activeNodeId = nodeId
      highlightNodeEdges(nodeId, true, { ping: true })
      if (event.pointerType === "touch" || event.pointerType === "pen") {
        const origin = { x: event.clientX, y: event.clientY }
        pointerOrigins.set(event.pointerId, origin)
        cancelLongPress(event.pointerId)
        const timer = window.setTimeout(() => {
          longPressTimers.delete(event.pointerId)
          const point = pointerOrigins.get(event.pointerId) ?? origin
          openMenu(nodeId, point)
        }, LONG_PRESS_DURATION)
        longPressTimers.set(event.pointerId, timer)
      }
    })
    const clearPointer = (event: PointerEvent) => {
      pointerOrigins.delete(event.pointerId)
      cancelLongPress(event.pointerId)
    }
    element.addEventListener("pointerup", clearPointer)
    element.addEventListener("pointercancel", clearPointer)
    element.addEventListener("click", (event) => {
      const target = event.target as HTMLElement | null
      if (target?.closest("a, button, input, textarea")) {
        return
      }
      focusNode(nodeId, { animate: true, minScale: 0.75 })
    })
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

  const initialRect = viewport.getBoundingClientRect()
  if (initialRect.width > 0 && initialRect.height > 0) {
    const fitScale = clamp(
      Math.min(initialRect.width / width, initialRect.height / height),
      state.minScale,
      state.maxScale,
    )
    if (Number.isFinite(fitScale) && fitScale > 0) {
      state.scale = fitScale
      state.translateX = (initialRect.width - width * state.scale) / 2
      state.translateY = (initialRect.height - height * state.scale) / 2
    }
  }

  const interactions = setupInteractions(viewer, state)
  interactions.applyTransform()

  const focusNode = (nodeId: string, options?: { animate?: boolean; minScale?: number }) => {
    const node = nodeMap.get(nodeId)
    const element = nodeElements.get(nodeId)
    if (!node || !element) {
      return
    }
    activeNodeId = nodeId
    closeMenu()
    const point: Point = {
      x: node.x - offset.x + node.width / 2,
      y: node.y - offset.y + node.height / 2,
    }
    interactions.focusCanvasPoint(point, options)
    glow.flash(element, "canvas-node-flash", NODE_FLASH_DURATION)
    glow.flash(element, "canvas-node-ping", NODE_FLASH_DURATION)
    const highlightDuration = Math.max(NODE_FLASH_DURATION, EDGE_PING_DURATION)
    focusExpiry.set(nodeId, now() + highlightDuration)
    highlightNodeEdges(nodeId, true, { ping: true })

    const release = () => {
      const expiry = focusExpiry.get(nodeId)
      if (!expiry) {
        return
      }
      if (now() >= expiry) {
        focusExpiry.delete(nodeId)
        const currentElement = nodeElements.get(nodeId)
        if (
          currentElement &&
          (currentElement.matches(":hover") || currentElement === document.activeElement)
        ) {
          highlightNodeEdges(nodeId, true)
          return
        }
        highlightNodeEdges(nodeId, false)
        return
      }
      scheduleFrame(release)
    }
    scheduleFrame(release)

    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href)
        url.hash = nodeId
        if (window.history && typeof window.history.pushState === "function") {
          const state = window.history.state ?? {}
          window.history.pushState({ ...state, canvas: nodeId }, document.title, url.toString())
        } else {
          window.location.hash = nodeId
        }
      } catch (error) {
        window.location.hash = nodeId
      }
    }
  }

  viewer.addEventListener("canvas:dbltap", () => {
    if (activeNodeId) {
      focusNode(activeNodeId, { animate: true, minScale: 0.85 })
    } else {
      interactions.fitToViewport({ animate: true })
    }
    closeMenu()
  })

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

  wikiLinks.forEach((record) => {
    const targetId = targetMap.get(record.target)
    if (!targetId) {
      record.element.classList.add("canvas-wikilink-unresolved")
      record.element.disabled = true
      return
    }
    record.element.dataset.targetId = targetId
    const showHighlight = () => highlightNodeEdges(targetId, true, { ping: true })
    const hideHighlight = () => highlightNodeEdges(targetId, false)
    const triggerFocus = () => {
      showHighlight()
      focusNode(targetId, { animate: true, minScale: 0.6 })
    }
    record.element.addEventListener("click", (event) => {
      event.preventDefault()
      triggerFocus()
    })
    record.element.addEventListener("pointerenter", showHighlight)
    record.element.addEventListener("pointerleave", hideHighlight)
    record.element.addEventListener("pointerdown", showHighlight)
    record.element.addEventListener("pointerup", hideHighlight)
    record.element.addEventListener("pointercancel", hideHighlight)
    record.element.addEventListener("focus", showHighlight)
    record.element.addEventListener("blur", hideHighlight)
    record.element.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        triggerFocus()
      }
    })
  })

  scheduleIdle(() => glow.prune())

  viewer.dataset["loaded"] = "true"
  viewer.dataset.canvasInitialised = "true"

  if (typeof window !== "undefined" && typeof window.addCleanup === "function") {
    window.addCleanup(() => {
      closeMenu()
      interactions.cleanup()
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
