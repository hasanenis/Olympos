import fs from "fs/promises"
import path from "path"
import { QuartzEmitterPlugin } from "../types"
import { QuartzComponentProps } from "../../components/types"
import HeaderConstructor from "../../components/Header"
import BodyConstructor from "../../components/Body"
import { pageResources, renderPage } from "../../components/renderPage"
import { FullPageLayout } from "../../cfg"
import { defaultContentPageLayout, sharedPageComponents } from "../../../quartz.layout"
import { pathToRoot, slugifyFilePath, joinSegments, FilePath, FullSlug, resolveRelative } from "../../util/path"
import { write } from "./helpers"
import { StaticResources } from "../../util/resources"
import CanvasPage, { CanvasData } from "../../components/pages/Canvas"
import { QuartzPluginData } from "../vfile"
import { BuildCtx } from "../../util/ctx"
import {
  buildCanvasFileData,
  collectCanvasFileEntries,
  isCanvasFile,
  toCanvasAliasSlug,
} from "../../util/canvas"

const emptyTree = { type: "root", children: [] } as const

async function writeAliasRedirect(ctx: BuildCtx, aliasSlug: FullSlug, targetSlug: FullSlug) {
  const aliasIndexSlug = joinSegments(aliasSlug, "index") as FullSlug
  const redirectUrl = resolveRelative(aliasIndexSlug, targetSlug)
  const aliasContent = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="refresh" content="0; url=${redirectUrl}">
    <link rel="canonical" href="${redirectUrl}">
    <meta name="robots" content="noindex">
    <title>${targetSlug}</title>
  </head>
  <body></body>
</html>
`

  await write({
    ctx,
    slug: aliasIndexSlug,
    ext: ".html",
    content: aliasContent,
  })
}

async function emitCanvasPage(
  ctx: BuildCtx,
  canvasPath: string,
  data: CanvasData,
  resources: StaticResources,
  layout: FullPageLayout,
  allFiles: QuartzPluginData[],
  canvasEntries: QuartzPluginData[],
) {
  const slug = slugifyFilePath(canvasPath as FilePath, true)
  const fileData = buildCanvasFileData(ctx, canvasPath, data)

  const externalResources = pageResources(pathToRoot(slug), resources)
  const componentData: QuartzComponentProps = {
    ctx,
    fileData,
    externalResources,
    cfg: ctx.cfg.configuration,
    children: [],
    tree: emptyTree as unknown as any,
    allFiles: [...allFiles, ...canvasEntries.filter((entry) => entry.slug !== fileData.slug), fileData],
  }

  const html = renderPage(ctx.cfg.configuration, slug, componentData, layout, externalResources)
  const outputPath = await write({ ctx, slug, content: html, ext: ".html" })

  const aliasSlug = toCanvasAliasSlug(canvasPath)
  await writeAliasRedirect(ctx, aliasSlug, slug)
  return outputPath
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
      const canvasFiles = ctx.allFiles.filter(isCanvasFile)
      if (canvasFiles.length === 0) return

      const allFiles = content.map((c) => c[1].data)
      const canvasEntries = collectCanvasFileEntries(ctx)
      for (const relativePath of canvasFiles) {
        const absolutePath = joinSegments(ctx.argv.directory, relativePath)
        try {
          const raw = await fs.readFile(absolutePath, "utf-8")
          const data = JSON.parse(raw) as CanvasData
          yield await emitCanvasPage(ctx, relativePath, data, resources, opts, allFiles, canvasEntries)
        } catch (err) {
          console.error(`Quartz: Failed to render canvas ${relativePath}`, err)
        }
      }
    },
    async *partialEmit(ctx, content, resources, changeEvents) {
      const relevant = changeEvents.filter((event) => path.extname(event.path) === ".canvas")
      if (relevant.length === 0) return

      const allFiles = content.map((c) => c[1].data)
      const canvasEntries = collectCanvasFileEntries(ctx)
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
          const aliasSlug = toCanvasAliasSlug(relativePath)
          const aliasDir = joinSegments(ctx.argv.output, aliasSlug)
          try {
            await fs.rm(aliasDir, { recursive: true, force: true })
          } catch (err) {
            if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
              console.error(`Quartz: Failed to remove canvas alias ${relativePath}`, err)
            }
          }
          continue
        }

        const absolutePath = joinSegments(ctx.argv.directory, relativePath)
        try {
          const raw = await fs.readFile(absolutePath, "utf-8")
          const data = JSON.parse(raw) as CanvasData
          yield await emitCanvasPage(ctx, relativePath, data, resources, opts, allFiles, canvasEntries)
        } catch (err) {
          console.error(`Quartz: Failed to render canvas ${relativePath}`, err)
        }
      }
    },
  }
}
