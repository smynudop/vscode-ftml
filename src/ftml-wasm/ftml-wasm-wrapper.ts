import initFtml, * as FTML from "./ftml.js"

/** Indicates if the WASM binding is loaded. */
export let ready = false

let resolveLoading: (value?: unknown) => void
/** Promise that resolves when the WASM binding has loaded. */
export const loading = new Promise(resolve => {
  resolveLoading = resolve
})

/** Actual output of the WASM instantiation. */
export let wasm: FTML.InitOutput | null = null

/** Loads the WASM required for the FTML library. */
export async function init(path?: FTML.InitInput) {
  // TODO: uncomment this as soon as Vite stops being bad
  // see TODO above this one
  // if (!path) path = (await import("../vendor/ftml_bg.wasm?url")).default
  //if (!path) path = new URL(wasmURL, location.href)
  wasm = await initFtml("__WASM_PLACEHOLDER__")
  ready = true
  resolveLoading()
}

/** Safely frees any WASM objects provided. */
export function free(objs: Set<any>) {
  for (const obj of objs) {
    if (typeof obj !== "object" || !("ptr" in obj)) continue
    if (obj.ptr !== 0) obj.free()
  }
}

type RenderedHTML = {
    html: string
    meta: any
    backlinks: any
}

type RenderSettings = "page"
type Layout = "wikijump" | "wikidot"

type IPageInfo = {
    readonly page: string;
    readonly site: string;
    readonly tags: any;
    readonly score: number;
    readonly title: string;
    readonly category: string | undefined;
    readonly language: string;
    readonly alt_title: string | undefined;
}
type PartialInfo  = Partial<IPageInfo>


/**
 * This set contains unfreed WASM objects. It is separate from any
 * particular function so that error recovery can still clear memory.
 */
const tracked = new Set<any>()

/** Adds a WASM object to the list of tracked objects. */
function trk<T>(obj: T): T {
  tracked.add(obj)
  return obj
}

/** Frees all objects being {@link tracked}, and clears the set. */
function freeTracked() {
  // use setTimeout so that we don't stall a function clearing memory
  // this speeds up returning objects, especially in a worker
  setTimeout(() => {
    free(tracked)
    tracked.clear()
  })
}

function makeSettings(settings: RenderSettings, layout: Layout): FTML.WikitextSettings {
  if (typeof settings === "string") {
    return FTML.WikitextSettings.from_mode(settings, layout)
  } else {
    return new FTML.WikitextSettings(settings)
  }
}

/** Creates a {@link PageInfo} object. Any properties not provided are mocked. */
export function makeInfo(partial?: PartialInfo): IPageInfo {
  return {
    alt_title: undefined,
    category: undefined,
    language: "default",
    score: 0,
    page: "unknown",
    site: "www",
    tags: [],
    title: "",
    ...partial
  }
}

/**
 * Renders a string of wikitext to HTML.
 *
 * @param str - The wikitext to render.
 * @param info - The page info to use.
 * @param mode - The wikitext rendering mode to use.
 * @param layout - The html layout to use.
 */
export function renderHTML(
  str: string,
  info?: PartialInfo,
  mode: RenderSettings = "page",
  layout: Layout = "wikijump"
): RenderedHTML {
  if (!ready) throw new Error("FTML wasn't ready yet!")
  try {
    const pageInfo = trk(new FTML.PageInfo(makeInfo(info)))
    const tokenized = trk(FTML.tokenize(str))
    const settings = trk(makeSettings(mode, layout))
    const parsed = trk(FTML.parse(tokenized, trk(pageInfo.copy()), trk(settings.copy())))
    const tree = trk(parsed.syntax_tree())
    const rendered = trk(FTML.render_html(tree, pageInfo, settings))

    const html = rendered.body()
    const meta = rendered.html_meta()
    const backlinks = rendered.backlinks()

    freeTracked()

    return { html, meta, backlinks }
  } catch (err) {
    freeTracked()
    throw err
  }
}