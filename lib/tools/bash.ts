import { tool } from "ai";
import { z } from "zod";

import { collectOutput, connectToSandbox, WORKSPACE_DIR } from "@/lib/sandbox";

const MAX_OUTPUT_CHARS = 20_000;

const truncate = (text: string): string => {
  if (text.length <= MAX_OUTPUT_CHARS) {
    return text;
  }

  // Keep the first and last portions so the model sees both the beginning and end
  const half = Math.floor(MAX_OUTPUT_CHARS / 2);
  const truncatedLines = text.slice(half, -half).split("\n").length;
  return `${text.slice(0, half)}\n\n... [${truncatedLines} lines truncated] ...\n\n${text.slice(-half)}`;
};

const sliceLines = (
  text: string,
  headLines?: number,
  tailLines?: number
): string => {
  if (!headLines && !tailLines) {
    return text;
  }

  const lines = text.split("\n");

  if (headLines && tailLines && headLines + tailLines < lines.length) {
    const head = lines.slice(0, headLines);
    const tail = lines.slice(-tailLines);
    const omitted = lines.length - headLines - tailLines;
    return [...head, `\n... [${omitted} lines omitted] ...\n`, ...tail].join(
      "\n"
    );
  }

  if (headLines && headLines < lines.length) {
    const omitted = lines.length - headLines;
    return `${lines.slice(0, headLines).join("\n")}\n\n... [${omitted} more lines] ...`;
  }

  if (tailLines && tailLines < lines.length) {
    const omitted = lines.length - tailLines;
    return `... [${omitted} earlier lines] ...\n\n${lines.slice(-tailLines).join("\n")}`;
  }

  return text;
};

const runBash = async (
  sandboxId: string,
  command: string,
  headLines?: number,
  tailLines?: number
): Promise<{
  exitCode: number;
  stderr: string;
  stdout: string;
  totalLines: number;
}> => {
  const sandbox = await connectToSandbox(sandboxId);

  try {
    const fullCommand = `export PATH="$HOME/.local/bin:$PATH" && cd "${WORKSPACE_DIR}" && ${command}`;
    const result = await sandbox.commands.run(fullCommand);
    const rawStdout = collectOutput(result.logs.stdout);
    const rawStderr = collectOutput(result.logs.stderr);
    const totalLines = rawStdout.split("\n").length;

    const stdout = truncate(sliceLines(rawStdout, headLines, tailLines));
    const stderr = truncate(sliceLines(rawStderr, headLines, tailLines));

    return {
      exitCode: result.error ? 1 : 0,
      stderr,
      stdout,
      totalLines,
    };
  } finally {
    sandbox.close();
  }
};

export const createBashTool = (sandboxId: string) =>
  tool({
    description: [
      "Execute bash commands in the sandbox environment.",
      "",
      `WORKING DIRECTORY: ${WORKSPACE_DIR}`,
      "All commands execute from this directory. Use relative paths from here.",
      "",
      "Use headLines/tailLines to limit output and save tokens:",
      "  headLines: 50           # only return the first 50 lines",
      "  tailLines: 30           # only return the last 30 lines",
      "  headLines + tailLines   # return first N and last M lines, omitting the middle",
      "",
      "The response includes totalLines so you know the full output size.",
    ].join("\n"),
    execute: ({ command, headLines, tailLines }) =>
      runBash(sandboxId, command, headLines, tailLines),
    inputSchema: z.object({
      command: z.string().describe("The bash command to execute"),
      headLines: z
        .number()
        .int()
        .positive()
        .optional()
        .describe(
          "Only return the first N lines of stdout/stderr. Useful for previewing large output."
        ),
      tailLines: z
        .number()
        .int()
        .positive()
        .optional()
        .describe(
          "Only return the last N lines of stdout/stderr. Useful for seeing errors at the end of logs."
        ),
    }),
  });
