/**
 * Anti-Detection Utilities
 *
 * Techniques to avoid detection when scraping:
 * - Random delays to mimic human behavior
 * - Exponential backoff for retries
 * - Rate limiting
 */

/**
 * Generates a random delay to mimic human browsing patterns
 *
 * @param min - Minimum delay in milliseconds (default: 1000)
 * @param max - Maximum delay in milliseconds (default: 3000)
 * @returns Promise that resolves after random delay
 *
 * @example
 * await randomDelay(2000, 5000); // Wait 2-5 seconds
 */
export async function randomDelay(min = 1000, max = 3000): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  console.log(`[AntiDetection] Waiting ${delay}ms...`);
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Generates a delay with exponential backoff for retries
 *
 * @param attempt - Current retry attempt (0-indexed)
 * @param baseDelay - Base delay in milliseconds (default: 1000)
 * @param maxDelay - Maximum delay cap in milliseconds (default: 30000)
 * @returns Promise that resolves after exponential delay
 *
 * @example
 * await exponentialBackoff(2); // Wait ~4 seconds (2^2 * 1000ms)
 */
export async function exponentialBackoff(
  attempt: number,
  baseDelay = 1000,
  maxDelay = 30000
): Promise<void> {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  // Add jitter to avoid thundering herd
  const jitter = Math.random() * 0.3 * delay;
  const totalDelay = delay + jitter;

  console.log(`[Backoff] Attempt ${attempt + 1}: waiting ${Math.round(totalDelay)}ms`);
  return new Promise(resolve => setTimeout(resolve, totalDelay));
}

/**
 * Rate limiter to control request frequency
 */
export class RateLimiter {
  private lastRequestTime = 0;
  private requestCount = 0;
  private windowStart = Date.now();

  constructor(
    private requestsPerSecond = 2,
    private _burstSize = 5,
    private windowMs = 60000 // 1 minute
  ) {}

  /**
   * Waits until a request can be made without exceeding rate limits
   *
   * @example
   * const limiter = new RateLimiter(2, 5); // 2 req/sec, 5 burst
   * await limiter.waitForSlot(); // Waits if needed
   */
  async waitForSlot(): Promise<void> {
    const now = Date.now();

    // Reset window if expired
    if (now - this.windowStart >= this.windowMs) {
      this.requestCount = 0;
      this.windowStart = now;
    }

    // Check burst limit (requests per minute)
    const maxRequestsPerWindow = this.requestsPerSecond * (this.windowMs / 1000);
    if (this.requestCount >= maxRequestsPerWindow) {
      const waitTime = this.windowMs - (now - this.windowStart);
      console.log(`[RateLimiter] Window limit reached, waiting ${Math.round(waitTime)}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.windowStart = Date.now();
    }

    // Check minimum delay between requests
    const minDelay = 1000 / this.requestsPerSecond;
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < minDelay) {
      const delay = minDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * Resets the rate limiter state
   */
  reset(): void {
    this.lastRequestTime = 0;
    this.requestCount = 0;
    this.windowStart = Date.now();
  }
}

/**
 * Retry logic with exponential backoff for failed requests
 *
 * @param fn - Async function to retry
 * @param maxAttempts - Maximum retry attempts (default: 3)
 * @param shouldRetry - Optional function to determine if error is retryable
 * @returns Result of successful function call
 *
 * @example
 * const data = await retryWithBackoff(
 *   () => scrapePage(),
 *   3,
 *   (error) => error.message.includes('timeout')
 * );
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  shouldRetry?: (error: any) => boolean
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if we should retry
      if (shouldRetry && !shouldRetry(error)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxAttempts - 1) {
        break;
      }

      console.error(`[Retry] Attempt ${attempt + 1} failed:`, error.message);
      await exponentialBackoff(attempt);
    }
  }

  throw lastError;
}
