import fs from "fs/promises"
import path from "path"
import { QuartzEmitterPlugin } from "../types"
import { QuartzComponentProps } from "../../components/types"
import HeaderConstructor from "../../components/Header"
import BodyConstructor from "../../components/Body"
import { pageResources, renderPage } from "../../components/renderPage"
import { FullPageLayout } from "../../cfg"
import { defaultContentPageLayout, sharedPageComponents } from "../../../quartz.layout"
import { pathToRoot, slugifyFilePath, joinSegments, FilePath } from "../../util/path"
import { write } from "./helpers"
import { StaticResources } from "../../util/resources"
import CanvasPage, { CanvasData } from "../../components/pages/Canvas"
import { QuartzPluginData } from "../vfile"
import { BuildCtx } from "../../util/ctx"

function titleFromFile(fp: string): string {
  const base = path.posix.basename(fp, path.extname(fp))
  return base
    .split(/[-_\s]+/)
    .filter((segment) => segment.length > 0)
    .map((segment) => segment[0]?.toLocaleUpperCase?.() + segment.slice(1))
    .join(" ")
    .trim() || base
}

const emptyTree = { type: "root", children: [] } as const

async function emitCanvasPage(
  ctx: BuildCtx,
  canvasPath: string,
  data: CanvasData,
  resources: StaticResources,
  layout: FullPageLayout,
  allFiles: QuartzPluginData[],
) {
  const slug = slugifyFilePath(canvasPath as FilePath, true)
  const fileData = {
    slug,
    filePath: joinSegments(ctx.argv.directory, canvasPath) as FilePath,
    relativePath: canvasPath as FilePath,
    frontmatter: {
      title: titleFromFile(canvasPath),
    },
    canvasData: data,
  } as QuartzPluginData & { canvasData: CanvasData }

  const externalResources = pageResources(pathToRoot(slug), resources)
  const componentData: QuartzComponentProps = {
    ctx,
    fileData,
    externalResources,
    cfg: ctx.cfg.configuration,
    children: [],
    tree: emptyTree as unknown as any,
    allFiles: [...allFiles, fileData],
  }

  const html = renderPage(ctx.cfg.configuration, slug, componentData, layout, externalResources)
  return write({ ctx, slug, content: html, ext: ".html" })
}

export const CanvasPageEmitter: QuartzEmitterPlugin = () => {
  const opts: FullPageLayout = {
    ...sharedPageComponents,
    ...defaultContentPageLayout,
    pageBody: CanvasPage(),
  }

  const { head: Head, header, beforeBody, pageBody, afterBody, left, right, footer: Footer } = opts
  const Header = HeaderConstructor()
  const Body = BodyConstructor()

  return {
    name: "CanvasPage",
    getQuartzComponents() {
      return [Head, Header, Body, ...header, ...beforeBody, pageBody, ...afterBody, ...left, ...right, Footer]
    },
    async *emit(ctx, content, resources) {
      const canvasFiles = ctx.allFiles.filter((fp) => fp.endsWith(".canvas"))
      if (canvasFiles.length === 0) return

      const allFiles = content.map((c) => c[1].data)
      for (const relativePath of canvasFiles) {
        const absolutePath = joinSegments(ctx.argv.directory, relativePath)
        try {
          const raw = await fs.readFile(absolutePath, "utf-8")
          const data = JSON.parse(raw) as CanvasData
          yield await emitCanvasPage(ctx, relativePath, data, resources, opts, allFiles)
        } catch (err) {
          console.error(`Quartz: Failed to render canvas ${relativePath}`, err)
        }
      }
    },
    async *partialEmit(ctx, content, resources, changeEvents) {
      const relevant = changeEvents.filter((event) => path.extname(event.path) === ".canvas")
      if (relevant.length === 0) return

      const allFiles = content.map((c) => c[1].data)
      for (const event of relevant) {
        const relativePath = event.path
        const slug = slugifyFilePath(relativePath as FilePath, true)
        if (event.type === "delete") {
          const target = joinSegments(ctx.argv.output, slug + ".html")
          try {
            await fs.unlink(target)
          } catch (err) {
            if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
              console.error(`Quartz: Failed to remove canvas page ${relativePath}`, err)
            }
          }
          continue
        }

        const absolutePath = joinSegments(ctx.argv.directory, relativePath)
        try {
          const raw = await fs.readFile(absolutePath, "utf-8")
          const data = JSON.parse(raw) as CanvasData
          yield await emitCanvasPage(ctx, relativePath, data, resources, opts, allFiles)
        } catch (err) {
          console.error(`Quartz: Failed to render canvas ${relativePath}`, err)
        }
      }
    },
  }
}
