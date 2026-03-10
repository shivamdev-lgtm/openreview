import { createOpenAI } from "@ai-sdk/openai";
import { stepCountIs, streamText } from "ai";
import type { ModelMessage, ToolSet } from "ai";

import type { SkillMetadata } from "@/lib/skills";
import { buildSkillsPrompt } from "@/lib/skills";
import { createBashTool } from "@/lib/tools/bash";
import { createLoadSkillTool } from "@/lib/tools/load-skill";
import { createReadFileTool } from "@/lib/tools/read-file";
import { createReplyTool } from "@/lib/tools/reply";
import { createWriteFileTool } from "@/lib/tools/write-file";
import { env } from "./env";

const instructions = `You are an expert software engineering assistant working inside a sandbox with a git repository checked out on a PR branch.

You have the following tools:

- **bash / readFile / writeFile** — run commands, read and write files inside the sandbox
- **reply** — post a top-level comment on the pull request
- **loadSkill** — load specialized review instructions for a specific domain

The \`gh\` CLI is authenticated and available in bash. The current PR is **#{{PR_NUMBER}}** in **{{REPO}}**.

Based on the user's request, decide what to do. Your capabilities include:

## Code Review
- Review the PR diff for bugs, security vulnerabilities, performance issues, code quality, missing error handling, and race conditions
- Use \`gh\` CLI for GitHub interactions:
  - \`gh pr diff {{PR_NUMBER}}\` — view the full diff
  - \`gh pr view {{PR_NUMBER}} --json files\` — list changed files
  - \`gh pr review {{PR_NUMBER}} --approve --body "..."\` — approve the PR
  - \`gh pr review {{PR_NUMBER}} --request-changes --body "..."\` — request changes
  - \`gh pr review {{PR_NUMBER}} --comment --body "..."\` — leave a review comment
  - \`gh api repos/{{REPO}}/pulls/{{PR_NUMBER}}/comments -f body="..." -f path="..." -f line=N -f commit_id="$(gh pr view {{PR_NUMBER}} --json headRefOid -q .headRefOid)"\` — inline comment on a specific line
- To suggest a code fix in an inline comment, use GitHub suggestion syntax:
  \`\`\`suggestion
  corrected code here
  \`\`\`
- Be specific and reference file paths and line numbers
- For each issue, explain what the problem is, why it matters, and how to fix it
- Don't nitpick style or formatting

## Linting & Formatting
- Run the project's linter and/or formatter when asked
- Check package.json scripts for lint/format commands (e.g. "check", "fix", "lint", "format")
- If no project-specific commands exist, fall back to \`npx ultracite check\` or \`npx ultracite fix\`
- Report any issues found, or confirm the code is clean

## Codebase Exploration
- Answer questions about the codebase structure, dependencies, or implementation details
- Use bash commands like find, grep, cat to explore

## Making Changes
- When asked to fix issues (formatting, lint errors, simple bugs), edit files directly using writeFile
- After making changes, verify they work by running relevant commands

## Replying
- Use the reply tool to post your response to the pull request
- Always reply at least once with your findings or actions taken
- Format replies as markdown
- Be concise and actionable
- End every reply with a line break, a horizontal rule, then: *Powered by [OpenReview](https://github.com/vercel-labs/openreview)*

## Getting Started
- Start by running \`gh pr diff {{PR_NUMBER}}\` to see what changed in this PR`;

const MAX_STEPS = 20;
const MAX_TOKENS = 200_000;

function getModel() {
  const provider = createOpenAI({
    apiKey: env.LITELLM_API_KEY ?? "",
    baseURL: env.LITELLM_BASE_URL ?? "http://localhost:4000/v1",
  });

  return provider(env.LITELLM_MODEL ?? "gpt-5-mini");
}

export const createAgentTools = (
  sandboxId: string,
  threadId: string,
  skills: SkillMetadata[]
): ToolSet => ({
  bash: createBashTool(sandboxId),
  loadSkill: createLoadSkillTool(skills),
  readFile: createReadFileTool(sandboxId),
  reply: createReplyTool(threadId),
  writeFile: createWriteFileTool(sandboxId),
});

export const runAgent = async (
  sandboxId: string,
  threadId: string,
  prNumber: number,
  repoFullName: string,
  skills: SkillMetadata[],
  messages: ModelMessage[]
): Promise<void> => {
  const skillsPrompt = buildSkillsPrompt(skills);
  const system = [
    instructions
      .replaceAll("{{PR_NUMBER}}", String(prNumber))
      .replaceAll("{{REPO}}", repoFullName),
    skillsPrompt,
  ]
    .filter(Boolean)
    .join("\n\n");

  const tools = createAgentTools(sandboxId, threadId, skills);
  const model = getModel();
  let totalTokens = 0;

  const result = streamText({
    model,
    system,
    messages,
    tools,
    stopWhen: [
      stepCountIs(MAX_STEPS),
      ({ steps }) => {
        for (const step of steps) {
          totalTokens +=
            (step.usage.inputTokens ?? 0) + (step.usage.outputTokens ?? 0);
        }
        return totalTokens > MAX_TOKENS;
      },
    ],
    onStepFinish: (step) => {
      console.log(
        `[agent] step: ${step.usage.inputTokens ?? 0} in / ${step.usage.outputTokens ?? 0} out`
      );
    },
  });

  // Consume the stream to completion
  for await (const _part of result.textStream) {
    // Stream is consumed; side effects happen via tool calls
  }
};
