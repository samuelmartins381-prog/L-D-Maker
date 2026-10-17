export interface ReadResult {
  /**
   * Markdown of the source. Readers of paged formats put `<!-- page N -->` or
   * `<!-- slide N -->` markers, which ingest turns into traceability anchors.
   */
  markdown: string;
  /** Images found in the source, written to ingest/media/<source>/. */
  media: { name: string; data: Uint8Array }[];
}
