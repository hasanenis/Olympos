// Lightweight ambient declarations so `tsc --noEmit` can run without the full
// dependency tree. These should only be used in constrained environments and
// defer to real packages when available.

// Basic JSX support so TSX files compile without @types/preact/react.
declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any
  }
  interface IntrinsicAttributes {
    [key: string]: any
  }
}

declare module "unified" {
  export type Processor = {
    use: (...pluggables: PluggableList) => Processor
    process: (...input: any[]) => Promise<any>
    parse: (...input: any[]) => any
    run: (...input: any[]) => Promise<any>
    stringify: (...input: any[]) => string
  }

  export type Plugin<Parameters extends any[] = any[]> = (
    ...parameters: Parameters
  ) => void | Processor | Promise<void | Processor> | ((...args: any[]) => any)

  export type Pluggable = Plugin | [Plugin, ...any[]] | Pluggable[] | false | null | undefined
  export type PluggableList = Pluggable | Pluggable[]

  export function unified(): Processor
}

declare module "vfile" {
  export interface DataMap {
    [key: string]: any
  }

  export class VFile<Message = any> {
    constructor(options?: string | { value?: string; path?: string; data?: DataMap })
    value: string
    path?: string
    basename?: string
    dirname?: string
    extname?: string
    data: DataMap
    history: string[]
    messages: Message[]
  }

  export default VFile
}

declare module "hast" {
  export type Root = any
  export type Element = any
  export type Properties = Record<string, any>
}

declare module "mdast" {
  export type Root = any
  export type Parent = any
  export type Text = any
  export type Html = any
  export type Paragraph = any
  export type Link = any
  export type Node = any
}

declare module "preact" {
  export type ComponentChildren = any
  export type FunctionalComponent<P = {}> = (props: P & { children?: ComponentChildren }) => any
  export type ComponentType<P = {}> = FunctionalComponent<P>
  export type VNode = any
  export type Ref<T = any> = { current: T | null }
  export const Fragment: any
  export function h(type: any, props: any, ...children: any[]): any
  export function createElement(type: any, props: any, ...children: any[]): any
}

declare module "preact/hooks" {
  export const useEffect: (...args: any[]) => void
  export const useMemo: <T>(factory: () => T, deps: any[]) => T
  export const useCallback: <T extends (...args: any[]) => any>(callback: T, deps: any[]) => T
  export const useState: <T>(initial: T | (() => T)) => [T, (value: T | ((prev: T) => T)) => void]
  export const useRef: <T>(initial: T | null) => { current: T | null }
  export const useLayoutEffect: typeof useEffect
}

declare module "preact/jsx-runtime" {
  export const jsx: any
  export const jsxs: any
  export const Fragment: any
}

declare module "preact-render-to-string" {
  export function render(vnode: any, context?: any, options?: any): string
}

declare module "unist" {
  export interface Node {
    [key: string]: any
  }
}

declare module "unist-util-visit" {
  export type BuildVisitor<T = any> = (
    node: T,
    index: number | null,
    parent: T | null,
  ) => void | boolean | number | Promise<void | boolean | number>

  export type Visitor<T = any> = (
    node: T,
    index: number | null,
    parent: T | null,
  ) => void | boolean | number | Promise<void | boolean | number>

  export function visit<Tree = any, Node = any>(tree: Tree, test: any, visitor: Visitor<Node>): void
}

declare module "unist-util-visit/lib" {
  export * from "unist-util-visit"
}

declare module "mdast-util-to-string" {
  export function toString(node: any): string
  export default toString
}

declare module "mdast-util-find-and-replace" {
  export type ReplaceFunction = (match: string, ...submatches: string[]) => any
  export function findAndReplace(
    tree: any,
    find: RegExp | string | Array<[RegExp | string, ReplaceFunction | string]>,
    replace?: ReplaceFunction | string,
  ): void
  export default function plugin(
    find: RegExp | string | Array<[RegExp | string, ReplaceFunction | string]>,
    replace?: ReplaceFunction | string,
  ): (tree: any) => void
}

declare module "rehype-pretty-code" {
  export interface Options {
    [key: string]: any
  }
  export type Theme = any
  export default function rehypePrettyCode(options?: Options): any
}

declare module "rehype-raw" {
  const plugin: any
  export default plugin
}

declare module "rehype-katex" {
  const plugin: any
  export default plugin
}

declare module "rehype-autolink-headings" {
  const plugin: any
  export default plugin
}

declare module "rehype-slug" {
  const plugin: any
  export default plugin
}

declare module "rehype-mathjax" {
  const plugin: any
  export default plugin
}

declare module "rehype-citation" {
  const plugin: any
  export default plugin
}

declare module "remark" {
  const remark: any
  export default remark
}

declare module "remark-parse" {
  const plugin: any
  export default plugin
}

declare module "remark-rehype" {
  const plugin: any
  export default plugin
}

declare module "remark-smartypants" {
  const plugin: any
  export default plugin
}

declare module "remark-math" {
  const plugin: any
  export default plugin
}

declare module "remark-frontmatter" {
  const plugin: any
  export default plugin
}

declare module "remark-breaks" {
  const plugin: any
  export default plugin
}

declare module "remark-gfm" {
  const plugin: any
  export default plugin
}

declare module "github-slugger" {
  export default class Slugger {
    constructor()
    slug(value: string): string
    reset(): void
  }
}

declare module "mdast-util-to-hast" {
  const toHast: any
  export default toHast
}

declare module "mdast-util-to-hast/lib/all" {
  const all: any
  export default all
}

declare module "mdast-util-to-hast/lib/handlers/code" {
  const handler: any
  export default handler
}

declare module "mdast-util-to-hast/lib/handlers/heading" {
  const handler: any
  export default handler
}

declare module "mdast-util-to-hast/lib/handlers/list" {
  const handler: any
  export default handler
}

declare module "@myriaddreamin/rehype-typst" {
  const plugin: any
  export default plugin
}

declare module "hast-util-to-html" {
  const toHtml: (tree: any, options?: any) => string
  export default toHtml
}

declare module "hast-util-to-jsx-runtime" {
  const toJsxRuntime: any
  export default toJsxRuntime
}

declare module "hast-util-to-string" {
  const toString: (node: any) => string
  export default toString
}

declare module "hast-util-whitespace" {
  const whitespace: (node: any) => boolean
  export default whitespace
}

declare module "unist-util-visit-parents" {
  export function visitParents(tree: any, test: any, visitor: any): void
  export default visitParents
}

declare module "unist-util-visit-children" {
  export default function visitChildren(node: any, visitor: any): void
}

declare module "unist-util-remove" {
  export default function remove(tree: any, test: any): void
}

declare module "unist-util-map" {
  export default function map(tree: any, iteratee: any): any
}

declare module "unist-util-parents" {
  export default function parents(tree: any, node: any): any[]
}

declare module "unist-util-is" {
  export default function is(
    node: any,
    test?: any,
    index?: any,
    parent?: any,
    context?: any,
  ): boolean
}

declare module "unist-util-position" {
  export function position(node: any, defaultPosition?: any): any
}

declare module "satori" {
  const satori: any
  export default satori
}

declare module "hast-util-to-estree" {
  const toEstree: any
  export default toEstree
}

declare module "rehype-format" {
  const plugin: any
  export default plugin
}

declare module "unified-args" {
  const plugin: any
  export default plugin
}

declare module "mdast-util-find-and-replace/lib" {
  const plugin: any
  export default plugin
}

declare module "source-map-support" {
  export interface RetrieveSourceMapResult {
    url: string
    map: string | null
  }

  export interface InstallOptions {
    handleUncaughtExceptions?: boolean
    environment?: string
    retrieveSourceMap?: (source: string) => RetrieveSourceMapResult | null | undefined
  }

  const sourceMapSupport: {
    install: (options?: InstallOptions) => void
  }

  export default sourceMapSupport
  export type Options = InstallOptions
}

declare module "util" {
  export function styleText(style: string | string[], text: string): string
}

declare module "process" {
  const process: {
    env: Record<string, string | undefined>
    cwd: () => string
    argv: string[]
    hrtime: (time?: [number, number]) => [number, number]
    exit: (code?: number) => never
    stderr: { write: (message: string) => void }
  }
  export default process
}

declare const process: {
  env: Record<string, string | undefined>
  cwd: () => string
  argv: string[]
  hrtime: (time?: [number, number]) => [number, number]
  exit: (code?: number) => never
  stderr: { write: (message: string) => void }
}

declare module "workerpool" {
  export const isMainThread: boolean
  export type WorkerPool = {
    proxy: <T = Record<string, any>>(modulePath: string) => Promise<T>
  }
}

declare module "micromorph" {
  export type Renderable = Element | DocumentFragment | HTMLElement | string
  export function morph(target: Element, template: Renderable, options?: any): void
}

declare module "@floating-ui/dom" {
  export const computePosition: (...args: any[]) => Promise<any>
  export const offset: (...args: any[]) => any
  export const flip: (...args: any[]) => any
  export const shift: (...args: any[]) => any
  export const inline: (...args: any[]) => any
  export const autoUpdate: (...args: any[]) => () => void
}

declare module "pixi.js" {
  const PIXI: any
  export = PIXI
}

declare module "flexsearch" {
  export interface DocumentOptions<T> {
    document: {
      id: string
      index: Array<keyof T>
      store?: boolean
    }
  }
  export class Document<T = any> {
    constructor(options: DocumentOptions<T>)
    add(id: string, document: T): void
    remove(id: string): void
    search(query: string, options?: any): Array<{ field: string; result: string[] }>
  }
}

declare module "d3" {
  const d3: any
  export = d3
}

declare module "pretty-time" {
  const prettyTime: (...args: any[]) => string
  export default prettyTime
}

declare module "fs" {
  const fs: any
  export = fs
}

declare module "path" {
  const path: any
  export = path
}

declare module "url" {
  export function fileURLToPath(url: string | URL): string
  export function pathToFileURL(path: string): URL
}

declare module "os" {
  const os: any
  export = os
}

declare module "perf_hooks" {
  export const performance: { now: () => number }
}

declare module "crypto" {
  export function randomUUID(): string
  const crypto: any
  export = crypto
}

declare module "async-mutex" {
  export class Mutex {
    acquire(): Promise<() => void>
    runExclusive<T>(callback: () => Promise<T> | T): Promise<T>
  }
}

declare module "minimatch" {
  export function minimatch(path: string, pattern: string, options?: any): boolean
}

declare module "reading-time" {
  interface ReadingTimeResult {
    text: string
    minutes: number
    time: number
    words: number
  }
  export default function readingTime(
    content: string,
    options?: { wordsPerMinute?: number },
  ): ReadingTimeResult
}

declare module "preact/src/jsx" {
  export interface JSXInternal {
    [key: string]: any
  }
  export default JSXInternal
}

declare module "node:test" {
  const test: any
  export default test
  export const describe: any
}

declare module "node:assert" {
  const assert: any
  export default assert
}

declare module "buffer" {
  export class Buffer<T = any> extends Uint8Array {
    static from(data: ArrayBuffer | string, encoding?: BufferEncoding): Buffer
  }
  export type BufferEncoding =
    | "ascii"
    | "utf8"
    | "utf-8"
    | "utf16le"
    | "ucs2"
    | "ucs-2"
    | "base64"
    | "base64url"
    | "latin1"
    | "binary"
    | "hex"
}
