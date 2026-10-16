export type Inline =
  | {
      kind: "text";
      text: string;
    }
  | {
      kind: "strong";
      children: Inline[];
    }
  | {
      kind: "em";
      children: Inline[];
    }
  | {
      kind: "link";
      href: string;
      children: Inline[];
    };
export declare function parseInline(source: string): Inline[];
/** Paragraphs are separated by blank lines in the source string. */
export declare function splitParagraphs(source: string): string[];
