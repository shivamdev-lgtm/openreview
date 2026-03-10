import { tool } from "ai";
import { z } from "zod";

import { connectToSandbox, WORKSPACE_DIR } from "@/lib/sandbox";

const writeFileToSandbox = async (
  sandboxId: string,
  path: string,
  content: string
): Promise<{ success: boolean }> => {
  const sandbox = await connectToSandbox(sandboxId);

  try {
    const resolvedPath = path.startsWith("/") ? path : `${WORKSPACE_DIR}/${path}`;

    // Ensure parent directory exists
    const dir = resolvedPath.substring(0, resolvedPath.lastIndexOf("/"));
    if (dir) {
      await sandbox.commands.run(`mkdir -p "${dir}"`);
    }

    await sandbox.files.writeFiles([
      { path: resolvedPath, data: content },
    ]);

    return { success: true };
  } finally {
    sandbox.close();
  }
};

export const createWriteFileTool = (sandboxId: string) =>
  tool({
    description:
      "Write content to a file in the sandbox. Creates parent directories if needed.",
    execute: ({ content, path }) => writeFileToSandbox(sandboxId, path, content),
    inputSchema: z.object({
      content: z.string().describe("The content to write to the file"),
      path: z.string().describe("The path where the file should be written"),
    }),
  });
