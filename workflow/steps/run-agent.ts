import { runAgent } from "@/lib/agent";
import { parseError } from "@/lib/error";
import type { ThreadMessage } from "@/workflow";

import { discoverSkills } from "./discover-skills";
import { startTyping } from "./start-typing";

export interface AgentResult {
  errorMessage?: string;
  success: boolean;
}

export const runAgentStep = async (
  sandboxId: string,
  threadMessages: ThreadMessage[],
  threadId: string,
  prNumber: number,
  repoFullName: string
): Promise<AgentResult> => {
  try {
    await startTyping(threadId, "Reviewing...");

    const skills = await discoverSkills([".agents/skills"]);

    await runAgent(
      sandboxId,
      threadId,
      prNumber,
      repoFullName,
      skills,
      threadMessages.map((msg) => ({
        content: msg.content,
        role: msg.role,
      }))
    );

    return { success: true };
  } catch (error) {
    return {
      errorMessage: parseError(error),
      success: false,
    };
  }
};
