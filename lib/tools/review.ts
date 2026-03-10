import { tool } from "ai";
import { z } from "zod";

import { getInstallationOctokit } from "@/lib/github";

export interface ReviewContext {
  owner: string;
  prNumber: number;
  repo: string;
}

const reviewCommentSchema = z.object({
  body: z
    .string()
    .describe(
      "The review comment body for this specific line/hunk. Use markdown. " +
        "For code fix suggestions, wrap them in a ```suggestion\\n...\\n``` block."
    ),
  line: z
    .number()
    .describe(
      "The line number in the diff that the comment applies to (end line for multi-line comments)."
    ),
  path: z
    .string()
    .describe(
      "The relative file path the comment applies to (e.g. src/utils.ts)."
    ),
  side: z
    .enum(["LEFT", "RIGHT"])
    .optional()
    .describe(
      "Which side of the diff the comment applies to. RIGHT (default) for additions/current code, LEFT for deletions/old code."
    ),
  startLine: z
    .number()
    .optional()
    .describe(
      "For multi-line comments, the first line of the range. Omit for single-line comments."
    ),
  startSide: z
    .enum(["LEFT", "RIGHT"])
    .optional()
    .describe("The side for the start of a multi-line comment range."),
});

export const createReviewTool = (context: ReviewContext) =>
  tool({
    description: [
      "Submit a pull request review with inline comments attached to specific lines of code.",
      "Use this to post a structured code review — each comment is pinned to a file and line,",
      "just like a human reviewer would do.",
      "",
      "Each comment in the `comments` array targets a specific file and line in the diff.",
      "Use GitHub suggestion blocks to propose code fixes:",
      "  ```suggestion",
      "  replacement code here",
      "  ```",
      "",
      "The `event` field controls the review type:",
      '  - "COMMENT" — general feedback, no approval/rejection',
      '  - "APPROVE" — approve the PR',
      '  - "REQUEST_CHANGES" — request changes before merging',
    ].join("\n"),
    execute: async ({ body, comments, event }) => {
      const octokit = await getInstallationOctokit();

      const reviewComments = comments.map((comment) => {
        const mapped: {
          body: string;
          line: number;
          path: string;
          side?: "LEFT" | "RIGHT";
          start_line?: number;
          start_side?: "LEFT" | "RIGHT";
        } = {
          body: comment.body,
          line: comment.line,
          path: comment.path,
        };

        if (comment.side) {
          mapped.side = comment.side;
        }
        if (comment.startLine) {
          mapped.start_line = comment.startLine;
          if (comment.startSide) {
            mapped.start_side = comment.startSide;
          }
        }

        return mapped;
      });

      try {
        await octokit.rest.pulls.createReview({
          body: body ?? "",
          comments: reviewComments,
          event,
          owner: context.owner,
          pull_number: context.prNumber,
          repo: context.repo,
        });

        return {
          commentCount: comments.length,
          event,
          success: true,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return {
          error: message,
          success: false,
        };
      }
    },
    inputSchema: z.object({
      body: z
        .string()
        .optional()
        .describe(
          "A top-level summary of the review. Shown at the top of the review. " +
            "Keep it brief — detailed feedback goes in the inline comments."
        ),
      comments: z
        .array(reviewCommentSchema)
        .min(1)
        .describe(
          "Inline review comments, each attached to a specific file and line in the diff."
        ),
      event: z
        .enum(["COMMENT", "APPROVE", "REQUEST_CHANGES"])
        .describe("The review action to take."),
    }),
  });
