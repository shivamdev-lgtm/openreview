import { tool } from "ai";
import { z } from "zod";

import { collectOutput, connectToSandbox, WORKSPACE_DIR } from "@/lib/sandbox";

const runBash = async (
  sandboxId: string,
  command: string
): Promise<{ exitCode: number; stderr: string; stdout: string }> => {
  const sandbox = await connectToSandbox(sandboxId);

  try {
    const fullCommand = `export PATH="$HOME/.local/bin:$PATH" && cd "${WORKSPACE_DIR}" && ${command}`;
    const result = await sandbox.commands.run(fullCommand);
    const stdout = collectOutput(result.logs.stdout);
    const stderr = collectOutput(result.logs.stderr);

    return {
      exitCode: result.error ? 1 : 0,
      stderr,
      stdout,
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
      "Common operations:",
      "  ls -la              # List files with details",
      "  find . -name '*.ts' # Find files by pattern",
      "  grep -r 'pattern' . # Search file contents",
      "  cat <file>          # View file contents",
    ].join("\n"),
    execute: ({ command }) => runBash(sandboxId, command),
    inputSchema: z.object({
      command: z.string().describe("The bash command to execute"),
    }),
  });
