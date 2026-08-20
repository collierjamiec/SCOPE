/**
 * undici (Node's fetch) only releases a connection back to its pool once the
 * response body is consumed or explicitly canceled. Every fetch() call site in
 * this project that doesn't need the body must call this — otherwise the open
 * keep-alive socket keeps the Node process alive until the remote server's own
 * keep-alive timeout fires (commonly ~75s), which looks like the CLI "hanging"
 * after it has already printed its final output.
 */
export async function discardBody(res: Response): Promise<void> {
  try {
    await res.body?.cancel();
  } catch {
    // best-effort; nothing to do if the body is already closed/errored
  }
}
