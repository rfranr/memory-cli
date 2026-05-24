export interface TextChunk {
  content: string;
  chunkIndex: number;
  chunkCount: number;
  chunkStart: number;
  chunkEnd: number;
}

export interface ChunkTextOptions {
  maxChunkSize?: number;
}

const DEFAULT_MAX_CHUNK_SIZE = 1_200;
const MIN_SPLIT_SIZE = 400;

export function chunkText(input: string, options: ChunkTextOptions = {}): TextChunk[] {
  const maxChunkSize = options.maxChunkSize ?? DEFAULT_MAX_CHUNK_SIZE;

  if (!Number.isInteger(maxChunkSize) || maxChunkSize < 1) {
    throw new Error("maxChunkSize must be a positive integer");
  }

  const chunksWithoutCount = paragraphRanges(input).flatMap((paragraph) => splitLargeParagraph(input, paragraph, maxChunkSize));
  const chunkCount = chunksWithoutCount.length;

  return chunksWithoutCount.map((chunk, chunkIndex) => ({
    ...chunk,
    chunkIndex,
    chunkCount,
  }));
}

function paragraphRanges(input: string): Array<Omit<TextChunk, "chunkIndex" | "chunkCount">> {
  const ranges: Array<Omit<TextChunk, "chunkIndex" | "chunkCount">> = [];
  const paragraphPattern = /\S[\s\S]*?(?=(?:\r?\n\s*){2,}|$)/g;
  let match: RegExpExecArray | null;

  while ((match = paragraphPattern.exec(input)) !== null) {
    const rawContent = match[0];
    const leadingWhitespace = /^\s*/.exec(rawContent)?.[0].length ?? 0;
    const trailingWhitespace = /\s*$/.exec(rawContent)?.[0].length ?? 0;
    const chunkStart = match.index + leadingWhitespace;
    const chunkEnd = match.index + rawContent.length - trailingWhitespace;
    const content = input.slice(chunkStart, chunkEnd);

    if (content.length > 0) {
      ranges.push({ content, chunkStart, chunkEnd });
    }

    if (match[0].length === 0) {
      paragraphPattern.lastIndex += 1;
    }
  }

  return ranges;
}

function splitLargeParagraph(
  input: string,
  paragraph: Omit<TextChunk, "chunkIndex" | "chunkCount">,
  maxChunkSize: number,
): Array<Omit<TextChunk, "chunkIndex" | "chunkCount">> {
  if (paragraph.content.length <= maxChunkSize) {
    return [paragraph];
  }

  const chunks: Array<Omit<TextChunk, "chunkIndex" | "chunkCount">> = [];
  let cursor = paragraph.chunkStart;

  while (cursor < paragraph.chunkEnd) {
    const remaining = paragraph.chunkEnd - cursor;
    let nextEnd = remaining <= maxChunkSize ? paragraph.chunkEnd : cursor + maxChunkSize;

    if (nextEnd < paragraph.chunkEnd) {
      const preferredEnd = findPreferredSplit(input, cursor, nextEnd);
      nextEnd = preferredEnd > cursor ? preferredEnd : nextEnd;
    }

    const chunkStart = skipLeadingWhitespace(input, cursor, nextEnd);
    const chunkEnd = trimTrailingWhitespace(input, chunkStart, nextEnd);

    if (chunkEnd > chunkStart) {
      chunks.push({
        content: input.slice(chunkStart, chunkEnd),
        chunkStart,
        chunkEnd,
      });
    }

    cursor = skipLeadingWhitespace(input, nextEnd, paragraph.chunkEnd);
  }

  return chunks;
}

function findPreferredSplit(input: string, start: number, hardEnd: number): number {
  for (let index = hardEnd; index > start + MIN_SPLIT_SIZE; index -= 1) {
    if (/\s/.test(input[index - 1] ?? "")) {
      return index;
    }
  }

  return hardEnd;
}

function skipLeadingWhitespace(input: string, start: number, end: number): number {
  let index = start;

  while (index < end && /\s/.test(input[index] ?? "")) {
    index += 1;
  }

  return index;
}

function trimTrailingWhitespace(input: string, start: number, end: number): number {
  let index = end;

  while (index > start && /\s/.test(input[index - 1] ?? "")) {
    index -= 1;
  }

  return index;
}
