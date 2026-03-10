import { tool } from "ai";
import { z } from "zod";

import { connectToSandbox, WORKSPACE_DIR } from "@/lib/sandbox";

const MAX_OUTPUT_CHARS = 20_000;

const truncate = (text: string): string => {
  if (text.length <= MAX_OUTPUT_CHARS) {
    return text;
  }

  const half = Math.floor(MAX_OUTPUT_CHARS / 2);
  const truncatedLines = text.slice(half, -half).split("\n").length;
  return `${text.slice(0, half)}\n\n... [${truncatedLines} lines truncated] ...\n\n${text.slice(-half)}`;
};

const extractLineRange = (
  content: string,
  startLine?: number,
  endLine?: number
): { content: string; totalLines: number } => {
  const lines = content.split("\n");
  const totalLines = lines.length;

  const start = Math.max(1, startLine ?? 1);
  const end = Math.min(totalLines, endLine ?? totalLines);

  const selected = lines.slice(start - 1, end);
  // Prefix each line with its line number for easy reference
  const numbered = selected.map(
    (line, i) => `${String(start + i).padStart(4, " ")} | ${line}`
  );

  return { content: numbered.join("\n"), totalLines };
};

const readFileFromSandbox = async (
  sandboxId: string,
  path: string,
  startLine?: number,
  endLine?: number
): Promise<{ content: string; totalLines: number }> => {
  const sandbox = await connectToSandbox(sandboxId);

  try {
    const resolvedPath = path.startsWith("/") ? path : `${WORKSPACE_DIR}/${path}`;
    const raw = await sandbox.files.readFile(resolvedPath);

    if (startLine || endLine) {
      const result = extractLineRange(raw, startLine, endLine);
      return { content: truncate(result.content), totalLines: result.totalLines };
    }

    const lines = raw.split("\n");
    return { content: truncate(raw), totalLines: lines.length };
  } finally {
    sandbox.close();
  }
};

export const createReadFileTool = (sandboxId: string) =>
  tool({
    description: [
      "Read the contents of a file from the sandbox.",
      "",
      "Supports reading specific line ranges to avoid loading entire large files.",
      "When startLine/endLine are provided, output includes line numbers for easy reference.",
      "The response always includes totalLines so you know the full file size.",
    ].join("\n"),
    execute: ({ endLine, path, startLine }) =>
      readFileFromSandbox(sandboxId, path, startLine, endLine),
    inputSchema: z.object({
      endLine: z
        .number()
        .int()
        .positive()
        .optional()
        .describe(
          "Last line to read (1-indexed, inclusive). Omit to read to end of file."
        ),
      path: z.string().describe("The path to the file to read"),
      startLine: z
        .number()
        .int()
        .positive()
        .optional()
        .describe(
          "First line to read (1-indexed, inclusive). Omit to start from the beginning."
        ),
    }),
  });
