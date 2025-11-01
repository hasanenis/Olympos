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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function formatText(node: CanvasNode): DocumentFragment {
  const frag = document.createDocumentFragment()
  const text = node.text ?? ""
  const lines = text.split(/\r?\n/)
  lines.forEach((line, idx) => {
    frag.append(document.createTextNode(line))
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

function createNodeElement(node: CanvasNode, offset: Point): HTMLDivElement {
  const el = document.createElement("div")
  el.className = `canvas-node canvas-node-${node.type}`
  el.style.left = `${node.x - offset.x}px`
  el.style.top = `${node.y - offset.y}px`
  el.style.width = `${node.width}px`
  el.style.height = `${node.height}px`

  if (node.background) {
    el.style.setProperty("--canvas-node-bg", node.background)
  }
  if (node.color) {
    el.style.setProperty("--canvas-node-color", node.color)
  }

  const content = document.createElement("div")
  content.className = "canvas-node-content"

  if (node.type === "text") {
    content.append(formatText(node))
  } else if (node.type === "file" && node.file?.path) {
    const link = document.createElement("a")
    link.href = node.file.path
    link.textContent = node.label ?? node.file.path
    link.className = "canvas-node-link"
    content.append(link)
  } else if (node.type === "link" && node.url) {
    const anchor = document.createElement("a")
    anchor.href = node.url
    anchor.target = "_blank"
    anchor.rel = "noopener noreferrer"
    anchor.textContent = node.label ?? node.url
    anchor.className = "canvas-node-link"
    content.append(anchor)
  } else if (node.type === "image" && node.image) {
    const img = document.createElement("img")
    img.src = node.image
    img.alt = node.label ?? "Canvas image"
    content.append(img)
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
      content.append(formatText(node))
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
): void {
  while (svg.firstChild) {
    svg.removeChild(svg.firstChild)
  }

  if (!edges || edges.length === 0) {
    return
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

  edges.forEach((edge) => {
    const from = nodes.get(edge.fromNode)
    const to = nodes.get(edge.toNode)
    if (!from || !to) return

    const start = anchorFor(from, edge.fromSide, offset)
    const end = anchorFor(to, edge.toSide, offset)

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
    const midX = (start.x + end.x) / 2
    const d = `M ${start.x} ${start.y} Q ${midX} ${start.y} ${end.x} ${end.y}`
    path.setAttribute("d", d)
    path.setAttribute("class", "canvas-edge")
    path.setAttribute("marker-end", "url(#canvas-arrow)")
    group.append(path)

    if (edge.label) {
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text")
      text.textContent = edge.label
      const labelX = (start.x + end.x) / 2
      const labelY = (start.y + end.y) / 2 - 8
      text.setAttribute("x", labelX.toString())
      text.setAttribute("y", labelY.toString())
      text.setAttribute("class", "canvas-edge-label")
      group.append(text)
    }
  })
}

type Cleanup = () => void

function setupInteractions(viewer: HTMLElement, state: ViewerState): Cleanup {
  const viewport = viewer.querySelector<HTMLDivElement>(".canvas-viewport")
  const inner = viewer.querySelector<HTMLDivElement>(".canvas-inner")
  if (!viewport || !inner) {
    return () => {}
  }

  let isPanning = false
  let startX = 0
  let startY = 0
  let startTranslateX = 0
  let startTranslateY = 0

  const applyTransform = () => {
    inner.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`
  }

  const zoomAroundPoint = (clientX: number, clientY: number, deltaScale: number) => {
    const rect = viewport.getBoundingClientRect()
    const offsetX = (clientX - rect.left - state.translateX) / state.scale
    const offsetY = (clientY - rect.top - state.translateY) / state.scale

    const nextScale = clamp(state.scale * deltaScale, state.minScale, state.maxScale)
    state.scale = nextScale
    state.translateX = clientX - rect.left - offsetX * state.scale
    state.translateY = clientY - rect.top - offsetY * state.scale
    state.translateX = clamp(state.translateX, rect.width - state.width * state.scale, 0)
    state.translateY = clamp(state.translateY, rect.height - state.height * state.scale, 0)
    applyTransform()
    viewer.dataset["scale"] = state.scale.toFixed(2)
    viewer.dataset["translate"] = `${state.translateX},${state.translateY}`
    viewport.dataset["panning"] = "false"
  }

  const onPointerDown = (event: PointerEvent) => {
    isPanning = true
    startX = event.clientX
    startY = event.clientY
    startTranslateX = state.translateX
    startTranslateY = state.translateY
    viewport.setPointerCapture(event.pointerId)
    viewport.dataset["panning"] = "true"
    event.preventDefault()
  }

  const onPointerMove = (event: PointerEvent) => {
    if (!isPanning) return
    const dx = event.clientX - startX
    const dy = event.clientY - startY
    const rect = viewport.getBoundingClientRect()
    state.translateX = clamp(startTranslateX + dx, rect.width - state.width * state.scale, 0)
    state.translateY = clamp(startTranslateY + dy, rect.height - state.height * state.scale, 0)
    applyTransform()
  }

  const endPan = (event: PointerEvent) => {
    if (!isPanning) return
    isPanning = false
    viewport.releasePointerCapture(event.pointerId)
    viewport.dataset["panning"] = "false"
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
    if (bestFit > state.scale) {
      state.scale = bestFit
      state.translateX = (rect.width - state.width * state.scale) / 2
      state.translateY = (rect.height - state.height * state.scale) / 2
      applyTransform()
    }
  })
  resizeObserver.observe(viewport)

  return () => {
    viewport.removeEventListener("pointerdown", onPointerDown)
    viewport.removeEventListener("pointermove", onPointerMove)
    viewport.removeEventListener("pointerup", endPan)
    viewport.removeEventListener("pointercancel", endPan)
    viewport.removeEventListener("pointerleave", onPointerLeave)
    viewport.removeEventListener("wheel", onWheel)
    buttonHandlers.forEach((cleanup) => cleanup())
    resizeObserver.disconnect()
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
  nodesContainer.innerHTML = ""
  nodes.forEach((node) => {
    const element = createNodeElement(node, offset)
    nodesContainer.append(element)
    nodeMap.set(node.id, node)
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
  renderEdges(svg, nodeMap, edges, offset)

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
    inner.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`
  }

  const cleanup = setupInteractions(viewer, state)
  viewer.dataset["loaded"] = "true"
  viewer.dataset.canvasInitialised = "true"

  if (typeof window !== "undefined" && typeof window.addCleanup === "function") {
    window.addCleanup(() => {
      cleanup()
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
