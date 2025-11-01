import path from "path"
import { BuildCtx } from "./ctx"
import { FilePath, FullSlug, joinSegments, slugifyFilePath } from "./path"
import { QuartzPluginData } from "../plugins/vfile"
import { CanvasData } from "../components/pages/Canvas"

const CANVAS_EXT = ".canvas"

export const isCanvasFile = (fp: string): boolean => fp.endsWith(CANVAS_EXT)

export const toCanvasSlug = (relativePath: string): FullSlug =>
  slugifyFilePath(relativePath as FilePath, true)

export const toCanvasAliasSlug = (relativePath: string): FullSlug =>
  `${toCanvasSlug(relativePath)}.canvas` as FullSlug

export const canvasTitleFromPath = (fp: string): string => {
  const base = path.posix.basename(fp, path.extname(fp))
  return (
    base
      .split(/[-_\s]+/)
      .filter((segment: string) => segment.length > 0)
      .map((segment: string) => segment[0]?.toLocaleUpperCase?.() + segment.slice(1))
      .join(" ")
      .trim() || base
  )
}

export const buildCanvasFileData = (
  ctx: BuildCtx,
  relativePath: string,
  data?: CanvasData,
): (QuartzPluginData & { canvasData?: CanvasData }) => {
  const slug = toCanvasSlug(relativePath)
  const absolute = joinSegments(ctx.argv.directory, relativePath) as FilePath
  const fileData = ({
    slug,
    filePath: absolute,
    relativePath: relativePath as FilePath,
    frontmatter: {
      title: canvasTitleFromPath(relativePath),
      tags: [],
    },
  } as QuartzPluginData & { canvasData?: CanvasData }) as unknown as QuartzPluginData & {
    canvasData?: CanvasData
  }

  if (data) {
    fileData.canvasData = data
  }

  return fileData
}

export const collectCanvasFileEntries = (ctx: BuildCtx): QuartzPluginData[] => {
  return ctx.allFiles
    .filter(isCanvasFile)
    .map((relativePath) => buildCanvasFileData(ctx, relativePath))
}
