import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"
// @ts-ignore
import script from "../scripts/canvas.inline"
import style from "../styles/canvas.scss"

export type CanvasNode = {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  text?: string
  label?: string
  color?: string
  background?: string
  url?: string
  file?: { path?: string }
  image?: string
}

export type CanvasEdge = {
  id: string
  fromNode: string
  toNode: string
  fromSide?: "top" | "bottom" | "left" | "right"
  toSide?: "top" | "bottom" | "left" | "right"
  label?: string
}

export type CanvasData = {
  nodes: CanvasNode[]
  edges?: CanvasEdge[]
}

const CanvasContent: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
  const data = (fileData as typeof fileData & { canvasData?: CanvasData }).canvasData
  const safeData = data ?? { nodes: [], edges: [] }
  const serialized = JSON.stringify(safeData).replaceAll("<", "\\u003C")

  const nodeCount = safeData.nodes.length
  const edgeCount = safeData.edges?.length ?? 0
  const slug = (fileData.slug ?? fileData.filePath ?? "canvas") as string
  const viewerId = `canvas-${slug.replace(/[^a-z0-9-]+/gi, "-")}`
  const viewportId = `${viewerId}-viewport`

  return (
    <article class="canvas-page">
      <div
        class="canvas-viewer"
        id={viewerId}
        data-node-count={nodeCount}
        data-edge-count={edgeCount}
        data-revision="reupload"
      >
        <div
          class="canvas-toolbar"
          role="toolbar"
          aria-label="Canvas controls"
          aria-controls={viewportId}
        >
          <div class="canvas-toolbar-group">
            <button
              type="button"
              class="canvas-button"
              data-action="zoom-in"
              aria-label="Yakınlaştır"
              aria-controls={viewportId}
            >
              +
            </button>
            <button
              type="button"
              class="canvas-button"
              data-action="zoom-out"
              aria-label="Uzaklaştır"
              aria-controls={viewportId}
            >
              –
            </button>
            <button
              type="button"
              class="canvas-button"
              data-action="fit"
              aria-label="Sığdır"
              aria-controls={viewportId}
            >
              ⤢
            </button>
            <button
              type="button"
              class="canvas-button"
              data-action="reset"
              aria-label="Sıfırla"
              aria-controls={viewportId}
            >
              ↺
            </button>
            <button
              type="button"
              class="canvas-button canvas-button-fullscreen"
              data-action="fullscreen"
              data-label-enter="⛶"
              data-label-exit="🗗"
              data-tooltip-enter="Tam ekran"
              data-tooltip-exit="Tam ekranı kapat"
              aria-label="Tam ekran"
              aria-pressed="false"
              aria-controls={viewportId}
            >
              ⛶
            </button>
          </div>
          <p class="canvas-hint" aria-live="polite">
            Fare tekerleği ile yakınlaştırın, sürükleyerek taşıyın. Dokunmatikte iki parmakla
            gezinin.
          </p>
        </div>
        <div class="canvas-viewport" id={viewportId} role="region" aria-live="polite">
          <div class="canvas-inner">
            <svg class="canvas-edges" aria-hidden="true"></svg>
            <div class="canvas-nodes" aria-hidden="true"></div>
          </div>
        </div>
        <div class="canvas-overlay" aria-hidden="true">
          <div class="canvas-overlay-panel" role="menu" hidden></div>
        </div>
        <dl class="canvas-summary">
          <div>
            <dt>Düğüm</dt>
            <dd>{nodeCount}</dd>
          </div>
          <div>
            <dt>Bağlantı</dt>
            <dd>{edgeCount}</dd>
          </div>
        </dl>
        <script
          type="application/json"
          data-canvas
          dangerouslySetInnerHTML={{
            __html: serialized,
          }}
        ></script>
      </div>
    </article>
  )
}

CanvasContent.css = style
CanvasContent.afterDOMLoaded = script

export default (() => CanvasContent) satisfies QuartzComponentConstructor
