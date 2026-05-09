import { AuthError } from "../types/schemas.js";

/**
 * Wraps a tool handler with consistent error handling.
 * Converts AuthError and API errors into MCP-compliant error responses.
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  try {
    const result = await fn();
    return {
      content: [
        {
          type: "text" as const,
          text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        content: [{ type: "text" as const, text: error.message }],
        isError: true,
      };
    }

    let message = error instanceof Error ? error.message : "Unknown error occurred";
    // Include API response body for better debugging
    if (error && typeof error === "object" && "response" in error) {
      const resp = (error as { response?: { data?: unknown; status?: number } }).response;
      if (resp?.data) {
        message += ` | Response: ${JSON.stringify(resp.data)}`;
      }
    }
    return {
      content: [{ type: "text" as const, text: `Error: ${message}` }],
      isError: true,
    };
  }
}
