/**
 * Limits shared by the browser and the critique route, so the client never
 * builds a request the server is bound to refuse.
 */

/** Critique rounds allowed per visit token. The server enforces this. */
export const MAX_CRITIQUE_ROUNDS = 3;

/** Largest decoded JPEG the critique route accepts. */
export const MAX_CRITIQUE_IMAGE_BYTES = 150 * 1024;

/**
 * Wall-clock budget for the whole loop in the browser, a hard stop. Sized for
 * three rounds at the slow end of what the critic has been measured to take.
 */
export const CRITIQUE_BUDGET_MS = 240_000;

/** A single critique request is abandoned after this long. */
export const CRITIQUE_ROUND_TIMEOUT_MS = 100_000;

/** Screenshot size sent to the critic: 16:9, about 420 image tokens. */
export const CAPTURE_WIDTH = 768;
export const CAPTURE_HEIGHT = 432;
export const CAPTURE_QUALITY = 0.8;

/** How long particles get to settle before each screenshot. */
export const CAPTURE_SETTLE_MS = 3_000;

/** Every score must reach this for the critic's verdict to be accept. */
export const ACCEPT_THRESHOLD = 4;
