import { tool } from "ai";
import { z } from "zod";

import { connectToSandbox, WORKSPACE_DIR } from "@/lib/sandbox";

const readFileFromSandbox = async (
  sandboxId: string,
  path: string
): Promise<{ content: string }> => {
  const sandbox = await connectToSandbox(sandboxId);

  try {
    const resolvedPath = path.startsWith("/") ? path : `${WORKSPACE_DIR}/${path}`;
    const content = await sandbox.files.readFile(resolvedPath);

    return { content };
  } finally {
    sandbox.close();
  }
};

export const createReadFileTool = (sandboxId: string) =>
  tool({
    description: "Read the contents of a file from the sandbox.",
    execute: ({ path }) => readFileFromSandbox(sandboxId, path),
    inputSchema: z.object({
      path: z.string().describe("The path to the file to read"),
    }),
  });
