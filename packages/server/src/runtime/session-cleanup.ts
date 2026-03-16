interface CleanupSessionParams {
  readonly session: {
    stop(): Promise<void>;
  } | null;
  readonly runAfterRun: () => Promise<void>;
}

export async function cleanupSession(
  params: CleanupSessionParams
): Promise<string | null> {
  let cleanupError: string | null = null;

  try {
    if (params.session) {
      await params.session.stop();
    }
  } catch (error: unknown) {
    cleanupError = error instanceof Error ? error.message : String(error);
  }

  try {
    await params.runAfterRun();
  } catch (error: unknown) {
    if (cleanupError === null) {
      cleanupError = error instanceof Error ? error.message : String(error);
    }
  }

  return cleanupError;
}
