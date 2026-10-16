/** Minimal typings for the Cloudflare Workers HTMLRewriter used by the Pages Functions. */
interface HTMLRewriterElement {
  setAttribute(name: string, value: string): void
  setInnerContent(content: string, opts?: { html?: boolean }): void
  append(content: string, opts?: { html?: boolean }): void
  remove(): void
}
declare class HTMLRewriter {
  on(selector: string, handlers: { element?: (e: HTMLRewriterElement) => void }): HTMLRewriter
  transform(res: Response): Response
}
