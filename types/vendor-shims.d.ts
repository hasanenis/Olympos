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
  export type Pluggable = Plugin<any> | [Plugin<any>, ...any[]] | Pluggable[] | false | null | undefined
  export type PluggableList = Pluggable | Pluggable[]

  export interface Processor<Input = any, Intermediate = any, Output = any, Data = any> {
    use: (...pluggables: PluggableList) => Processor<Input, Intermediate, Output, Data>
    process: (...input: any[]) => Promise<Output>
    parse: (...input: any[]) => Intermediate
    run: (...input: any[]) => Promise<Intermediate>
    stringify: (...input: any[]) => string
    data?: Data
  }

  export type Plugin<Parameters extends any[] = any[], Proc extends Processor = Processor> = (
    ...parameters: Parameters
  ) => void | Proc | Promise<void | Proc> | ((...args: any[]) => any)

  export function unified<Input = any, Intermediate = any, Output = any, Data = any>(): Processor<
    Input,
    Intermediate,
    Output,
    Data
  >
}

declare module "vfile" {
  export interface DataMap {
    [key: string]: any
    aliases?: any[]
    dates?: any
    description?: string
    text?: string
    title?: string
    frontmatter?: any
    tags?: any
    slug?: any
    filePath?: any
  }

  export type Data = DataMap

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
  export type Node = any
  export type Literal = any
}

declare module "mdast" {
  export type Root = any
  export type Parent = any
  export type Text = any
  export type Html = any
  export type Paragraph = any
  export type Link = any
  export type Node = any
  export type BlockContent = any
  export type PhrasingContent = any
  export type DefinitionContent = any
  export type Code = any
}

declare module "preact" {
  export type ComponentChildren = any
  export type FunctionalComponent<P = {}> = ((props: P & { children?: ComponentChildren }) => any) & {
    displayName?: string
    defaultProps?: Partial<P>
  }
  export type ComponentType<P = {}> = FunctionalComponent<P>
  export type VNode = any
  export type Ref<T = any> = { current: T | null }
  export const Fragment: any
  export namespace JSX {
    type Element = any
    interface IntrinsicElements {
      [key: string]: any
    }
    interface IntrinsicAttributes {
      [key: string]: any
    }
  }
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
  export namespace JSX {
    type Element = any
    interface IntrinsicElements {
      [key: string]: any
    }
  }
}

declare module "preact/src/jsx" {
  export namespace JSXInternal {
    type Element = any
    interface IntrinsicElements {
      [key: string]: any
    }
    interface IntrinsicAttributes {
      [key: string]: any
    }
  }
  export = JSXInternal
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
  export type BuildVisitor<Tree = any, Check = any> = (
    node: any,
    index: number | null,
    parent: any | null,
  ) => void | boolean | number | Promise<void | boolean | number>

  export type Visitor<Node = any> = (
    node: Node,
    index: number | null,
    parent: any | null,
  ) => void | boolean | number | typeof SKIP | Promise<void | boolean | number | typeof SKIP>

  export function visit<Tree = any, Check = any>(
    tree: Tree,
    test: Check,
    visitor: Visitor<any>,
  ): void
  export const SKIP: unique symbol
}

declare module "globby" {
  export type GlobbyFilterFunction = (path: string) => boolean
  export type GlobbyPattern = string | readonly string[]
  export type GlobbyOptions = Record<string, any>

  export function globby(patterns: GlobbyPattern, options?: GlobbyOptions): Promise<string[]>
  export function globbySync(patterns: GlobbyPattern, options?: GlobbyOptions): string[]
  export function isGitIgnored(options?: GlobbyOptions): Promise<GlobbyFilterFunction>
  export function generateGlobTasks(patterns: GlobbyPattern, options?: GlobbyOptions): any[]

  const globbyExport: typeof globby
  export default globbyExport
}

declare module "chokidar" {
  export interface FSWatcher {
    on(event: "add" | "change" | "unlink", listener: (path: string) => void): FSWatcher
    on(event: string, listener: (...args: any[]) => void): FSWatcher
    close(): Promise<void>
  }

  export interface WatchOptions {
    persistent?: boolean
    ignoreInitial?: boolean
    ignored?: any
    cwd?: string
    depth?: number
    awaitWriteFinish?: any
  }

  export function watch(paths: string | readonly string[], options?: WatchOptions): FSWatcher
  export default watch
}

declare module "github-slugger" {
  export type Options = {
    maintainCase?: boolean
    truncate?: number
  }

  export function slug(value: string, options?: Options): string

  export default class GithubSlugger {
    slug(value: string, options?: Options): string
    reset(): void
  }
}

declare module "satori/wasm" {
  export type FontWeight = number | string
  export interface FontConfig {
    name: string
    data: ArrayBuffer | Uint8Array
    weight?: FontWeight
    style?: string
  }
  export interface SatoriOptions {
    width: number
    height: number
    fonts?: FontConfig[]
    embedFont?: boolean
    background?: string
  }

  export default function satori(component: any, options: SatoriOptions): Promise<string>
}

declare module "satori" {
  export type SatoriOptions = any
  const satori: any
  export default satori
}

declare module "source-map-support" {
  export interface Options {
    environment?: string
    handleUncaughtExceptions?: boolean
    hookRequire?: boolean
    overrideRetrieveFile?: boolean
    retrieveSourceMap?: (source: string) => { map: string } | null
  }
  export function install(options?: Options): void
  const sourceMapSupport: {
    install: typeof install
    Options: Options
  }
  namespace sourceMapSupport {
    type Options = import("source-map-support").Options
  }
  export default sourceMapSupport
}

declare module "fs" {
  export const promises: {
    readFile(path: string, options?: any): Promise<any>
    writeFile(path: string, data: any, options?: any): Promise<void>
    mkdir(path: string, options?: any): Promise<void>
    rm(path: string, options?: any): Promise<void>
    readdir(path: string, options?: any): Promise<string[]>
    stat(path: string): Promise<{ isDirectory(): boolean }>
    access(path: string, mode?: number): Promise<void>
    copyFile(src: string, dest: string, mode?: number): Promise<void>
  }
  export function readFile(path: string, options?: any): any
  export function writeFile(path: string, data: any, options?: any): void
  export function existsSync(path: string): boolean
  export function mkdirSync(path: string, options?: any): void
  export function statSync(path: string): { isDirectory(): boolean }
  export function readdirSync(path: string, options?: any): string[]
}

declare module "fs/promises" {
  export function readFile(path: string, options?: any): Promise<any>
  export function writeFile(path: string, data: any, options?: any): Promise<void>
  export function mkdir(path: string, options?: any): Promise<void>
  export function rm(path: string, options?: any): Promise<void>
  export function readdir(path: string, options?: any): Promise<string[]>
  export function stat(path: string): Promise<{ isDirectory(): boolean }>
  export function access(path: string, mode?: number): Promise<void>
  export function copyFile(src: string, dest: string, mode?: number): Promise<void>
  export function unlink(path: string): Promise<void>
}

declare module "path" {
  export function join(...segments: string[]): string
  export function resolve(...segments: string[]): string
  export function dirname(path: string): string
  export function basename(path: string, ext?: string): string
  export function extname(path: string): string
  export function relative(from: string, to: string): string
  export const sep: string
}

declare module "url" {
  export class URL {
    constructor(url: string, base?: string)
    href: string
    hash: string
  }
}

declare module "os" {
  export function homedir(): string
  export function tmpdir(): string
  export function platform(): string
}

declare module "undici" {
  export function fetch(input: string, init?: any): Promise<Response>
}

declare module "canvas" {
  export const createCanvas: (...args: any[]) => any
}

declare module "stream" {
  export class Readable {
    constructor(options?: any)
    read(size?: number): any
  }
}

declare module "node:fs/promises" {
  export * from "fs/promises"
}

declare module "esbuild" {
  export interface BuildOptions {
    entryPoints?: string[]
    outfile?: string
    bundle?: boolean
    format?: string
    platform?: string
    sourcemap?: boolean | "inline"
    target?: string | string[]
    metafile?: boolean
    write?: boolean
    plugins?: any[]
    define?: Record<string, string>
    external?: string[]
    loader?: Record<string, string>
    outdir?: string
    keepNames?: boolean
    sourcesContent?: boolean
    packages?: "external" | "none"
  }
  export interface BuildResult {
    outputFiles?: Array<{ path: string; text: string }>
    metafile?: any
  }
  export function build(options: BuildOptions): Promise<BuildResult>
  export function transform(code: string, options?: any): Promise<{ code: string; map?: string }>
}

declare module "remark-parse/lib" {
  export type Root = any
  const plugin: (...args: any[]) => any
  export default plugin
}

declare module "to-vfile" {
  export type VFileLike = { path?: string; value?: string; data?: Record<string, any> }
  export interface VFileData extends VFileLike {
    data: DataMap
    history: string[]
    messages: any[]
    value: string
  }
  export function read(path: string | VFileLike): Promise<VFileData>
  export function write(file: VFileLike, options?: any): Promise<void>
  export default function toVFile(options: VFileLike | string): VFileData
}

declare module "workerpool" {
  export class Promise<T> extends globalThis.Promise<T> {}
  export interface WorkerPool {
    proxy(): globalThis.Promise<any>
    terminate(force?: boolean): globalThis.Promise<void>
    exec(method: string, params?: any[]): globalThis.Promise<any>
  }
  export function pool(path?: string | null, options?: any): WorkerPool
  const workerpool: {
    Promise: typeof Promise
    pool: typeof pool
  }
  export default workerpool
}

declare module "rfdc" {
  export interface Options {
    circles?: boolean
    proto?: boolean
    constructor?: boolean
  }
  export type Clone = <T>(input: T) => T
  export default function rfdc(options?: Options): Clone
}

declare module "node:test" {
  export const describe: (...args: any[]) => void
  export const it: (...args: any[]) => void
  export const beforeEach: (...args: any[]) => void
  export const afterEach: (...args: any[]) => void
}

declare module "hast-util-to-jsx-runtime" {
  export type Components = Record<string, any>
  export type Jsx = { Fragment: any; jsx: any; jsxs: any }
  export function toJsxRuntime(tree: any, options: {
    Fragment: any
    jsx: any
    jsxs: any
    elementAttributeNameCase?: string
    development?: boolean
    components?: Components
  }): any
}

declare module "hast-util-to-string" {
  export default function toString(node: any): string
  export function toString(node: any): string
}

declare module "mdast-util-to-hast" {
  export type Options = Record<string, any>
  export function toHast(tree: any, options?: Options): any
  const defaultExport: typeof toHast
  export default defaultExport
}

declare module "hast-util-to-html" {
  export type Options = Record<string, any>
  export function toHtml(tree: any, options?: Options): string
  const defaultExport: typeof toHtml
  export default defaultExport
}

declare module "gray-matter" {
  export interface GrayMatterFile<T = any> {
    content: string
    data: T
    excerpt?: string
  }
  export default function matter<T = any>(input: string, options?: any): GrayMatterFile<T>
}

declare module "js-yaml" {
  export function load(input: string, options?: any): any
  export const JSON_SCHEMA: any
}

declare module "toml" {
  export function parse(input: string): any
}

declare module "@napi-rs/simple-git" {
  export class Repository {
    static discover(path: string): Repository
    log(options?: any): Promise<any>
    workdir(): string
    getFileLatestModifiedDateAsync(path: string): Promise<Date>
  }
  export type SimpleGit = {
    log(options?: any): Promise<any>
  }
  export function simpleGit(options?: any): SimpleGit
}

declare module "rehype-mathjax/svg" {
  export type Options = any
  export default function rehypeMathjaxSvg(options?: any): any
}

declare module "katex" {
  export interface KatexOptions {
    displayMode?: boolean
    throwOnError?: boolean
    errorColor?: string
    macros?: Record<string, string>
    trust?: boolean
  }
  export function renderToString(tex: string, options?: any): string
}

declare module "is-absolute-url" {
  export default function isAbsoluteUrl(input: string): boolean
}

declare module "flexsearch" {
  export type DefaultDocumentSearchResults = any
  export interface Document<T = any> {
    addAsync(id: any, doc: T): Promise<void>
    searchAsync(query: any, options?: any): Promise<any>
  }
  export function Document<T = any>(config: any): Document<T>
}

declare module "micromorph" {
  export default function micromorph(target: Element, source: Element): void
}

declare module "lightningcss" {
  export const transform: any
  export const Features: any
}

declare module "ansi-truncate" {
  export default function ansiTruncate(input: string, columns: number): string
}

declare module "readline" {
  export interface Interface {
    close(): void
  }
  export function createInterface(options: any): Interface
  export function clearLine(stream: NodeJS.WriteStream, dir: number): void
  export function cursorTo(stream: NodeJS.WriteStream, x?: number, y?: number): void
  const readline: {
    createInterface: typeof createInterface
    clearLine: typeof clearLine
    cursorTo: typeof cursorTo
  }
  export default readline
}

declare const Buffer: {
  from(source: ArrayBuffer | ArrayLike<number> | string, encoding?: string): any
  alloc(size: number): any
}

type Buffer<T = any> = any

declare namespace NodeJS {
  interface WriteStream {
    write(str: string): void
    cursorTo(x?: number, y?: number): void
    clearLine(dir: number): void
    isTTY?: boolean
    columns?: number
  }
  type Timeout = number
  interface ErrnoException extends Error {
    code?: string | number
    path?: string
    syscall?: string
  }
}

declare const process: {
  env: Record<string, string | undefined>
  cwd(): string
  argv: string[]
  stdout: NodeJS.WriteStream
  stderr: NodeJS.WriteStream
  exit(code?: number): void
  hrtime(time?: [number, number]): [number, number]
}

declare const __dirname: string

declare module "*" {
  const value: any
  export default value
  export = value
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
