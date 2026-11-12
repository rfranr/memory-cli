export interface TextChunk {
  content: string;
  chunkIndex: number;
  chunkCount: number;
  chunkStart: number;
  chunkEnd: number;
}

export interface ChunkTextOptions {
  maxChunkSize?: number;
  minChunkSize?: number;
}

// Target: ~1000-1200 chars.
const DEFAULT_MAX_CHUNK_SIZE = 1_200;
// Minimum useful chunk size: avoid one-liners.
const DEFAULT_MIN_CHUNK_SIZE = 250;
const MIN_SPLIT_SIZE = 400;

export function chunkText(input: string, options: ChunkTextOptions = {}): TextChunk[] {
  const maxChunkSize = options.maxChunkSize ?? DEFAULT_MAX_CHUNK_SIZE;
  const minChunkSize = options.minChunkSize ?? DEFAULT_MIN_CHUNK_SIZE;

  if (!Number.isInteger(maxChunkSize) || maxChunkSize < 1) {
    throw new Error('maxChunkSize must be a positive integer');
  }

  if (!Number.isInteger(minChunkSize) || minChunkSize < 0) {
    throw new Error('minChunkSize must be a non-negative integer');
  }

  const initialChunks = paragraphRanges(input).flatMap((paragraph) =>
    splitLargeParagraph(input, paragraph, maxChunkSize),
  );
  const mergedChunks = mergeSmallChunks(input, initialChunks, { maxChunkSize, minChunkSize });
  const chunkCount = mergedChunks.length;

  return mergedChunks.map((chunk, chunkIndex) => ({
    ...chunk,
    chunkIndex,
    chunkCount,
  }));
}

function mergeSmallChunks(
  input: string,
  chunks: Array<Omit<TextChunk, 'chunkIndex' | 'chunkCount'>>,
  options: { maxChunkSize: number; minChunkSize: number },
): Array<Omit<TextChunk, 'chunkIndex' | 'chunkCount'>> {
  if (chunks.length <= 1) {
    return chunks;
  }

  const merged: Array<Omit<TextChunk, 'chunkIndex' | 'chunkCount'>> = [];
  let cursor = 0;

  while (cursor < chunks.length) {
    const start = chunks[cursor].chunkStart;

    cursor = lastMergeableChunk(chunks, cursor, options.maxChunkSize);
    const end = chunks[cursor].chunkEnd;

    merged.push({
      chunkStart: start,
      chunkEnd: end,
      content: input.slice(start, end),
    });

    cursor += 1;
  }

  mergeFinalLeftover(input, merged, options);

  return merged;
}

function lastMergeableChunk(
  chunks: Array<Omit<TextChunk, 'chunkIndex' | 'chunkCount'>>,
  cursor: number,
  maxChunkSize: number,
): number {
  const start = chunks[cursor].chunkStart;

  while (cursor + 1 < chunks.length) {
    if (chunks[cursor + 1].chunkEnd - start > maxChunkSize) {
      break;
    }

    cursor += 1;
  }

  return cursor;
}

function mergeFinalLeftover(
  input: string,
  merged: Array<Omit<TextChunk, 'chunkIndex' | 'chunkCount'>>,
  options: { maxChunkSize: number; minChunkSize: number },
): void {
  // Avoid tiny final leftovers if possible.
  if (merged.length < 2) {
    return;
  }

  const last = merged[merged.length - 1];
  const prev = merged[merged.length - 2];
  const lastLength = last.chunkEnd - last.chunkStart;
  const mergedLength = last.chunkEnd - prev.chunkStart;

  if (lastLength < options.minChunkSize && mergedLength <= options.maxChunkSize) {
    merged.splice(merged.length - 2, 2, {
      chunkStart: prev.chunkStart,
      chunkEnd: last.chunkEnd,
      content: input.slice(prev.chunkStart, last.chunkEnd),
    });
  }
}

function paragraphRanges(input: string): Array<Omit<TextChunk, 'chunkIndex' | 'chunkCount'>> {
  const ranges: Array<Omit<TextChunk, 'chunkIndex' | 'chunkCount'>> = [];
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
  paragraph: Omit<TextChunk, 'chunkIndex' | 'chunkCount'>,
  maxChunkSize: number,
): Array<Omit<TextChunk, 'chunkIndex' | 'chunkCount'>> {
  if (paragraph.content.length <= maxChunkSize) {
    return [paragraph];
  }

  const chunks: Array<Omit<TextChunk, 'chunkIndex' | 'chunkCount'>> = [];
  let cursor = paragraph.chunkStart;

  while (cursor < paragraph.chunkEnd) {
    const nextEnd = nextChunkEnd(input, cursor, paragraph.chunkEnd, maxChunkSize);

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

function nextChunkEnd(input: string, cursor: number, end: number, maxChunkSize: number): number {
  const hardEnd = Math.min(end, cursor + maxChunkSize);

  if (hardEnd === end) {
    return end;
  }

  const preferredEnd = findPreferredSplit(input, cursor, hardEnd);

  return preferredEnd > cursor ? preferredEnd : hardEnd;
}

function findPreferredSplit(input: string, start: number, hardEnd: number): number {
  for (let index = hardEnd; index > start + MIN_SPLIT_SIZE; index -= 1) {
    if (/\s/.test(input[index - 1] ?? '')) {
      return index;
    }
  }

  return hardEnd;
}

function skipLeadingWhitespace(input: string, start: number, end: number): number {
  let index = start;

  while (index < end && /\s/.test(input[index] ?? '')) {
    index += 1;
  }

  return index;
}

function trimTrailingWhitespace(input: string, start: number, end: number): number {
  let index = end;

  while (index > start && /\s/.test(input[index - 1] ?? '')) {
    index -= 1;
  }

  return index;
}
