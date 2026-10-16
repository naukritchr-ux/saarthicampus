/**
 * storageHelpers.js
 * Supabase Storage URL parsing, path sanitization, and authorization helpers.
 */

const ALLOWED_STORAGE_BUCKETS = Object.freeze([
  "resumes",
  "Resumes",
  "candidate-photos",
  "candidate-documents",
]);

/**
 * Safely parses a storage URL or explicit bucket/path into normalized { bucket, path }.
 * Supports:
 * - Full public URLs: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
 * - Full signed URLs: https://<project>.supabase.co/storage/v1/object/sign/<bucket>/<path>?token=...
 * - Relative paths: /storage/v1/object/(public|sign)/<bucket>/<path>
 * - Raw path with bucket argument: (bucket: "resumes", path: "123_resume.pdf")
 *
 * @param {string} urlOrPath - Full URL, pathname, or object path
 * @param {string} [explicitBucket] - Optional explicit bucket name
 * @returns {{ bucket: string, path: string } | null}
 */
function parseStorageUrl(input, explicitBucket = null) {
  if (!input && !explicitBucket) return null;

  let urlOrPath = input;
  let bucket = explicitBucket || null;

  // Support object parameter: parseStorageUrl({ url, path, bucket })
  if (input && typeof input === "object" && !Buffer.isBuffer(input)) {
    urlOrPath = input.url || input.path || null;
    bucket = input.bucket || explicitBucket || null;
  }

  if (!urlOrPath && !bucket) return null;

  let rawPath = null;

  if (typeof urlOrPath === "string" && urlOrPath.trim() !== "") {
    const trimmed = urlOrPath.trim();

    // Check if it's a full URL
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      try {
        const parsed = new URL(trimmed);
        const match = parsed.pathname.match(
          /\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/
        );
        if (match) {
          bucket = match[1];
          rawPath = decodeURIComponent(match[2]);
        } else {
          // URL is not a Supabase storage URL
          return null;
        }
      } catch {
        return null;
      }
    } else if (trimmed.startsWith("/storage/v1/object/")) {
      // Relative pathname format
      const match = trimmed.match(
        /^\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/
      );
      if (match) {
        bucket = match[1];
        // Strip query string if present
        const cleanPath = match[2].split("?")[0];
        rawPath = decodeURIComponent(cleanPath);
      } else {
        return null;
      }
    } else {
      // Treat as raw path if bucket is provided
      rawPath = trimmed.split("?")[0];
    }
  }

  if (!bucket || !ALLOWED_STORAGE_BUCKETS.includes(bucket)) {
    return null;
  }

  if (!rawPath || typeof rawPath !== "string") {
    return null;
  }

  // Prevent path traversal and strip leading slashes
  const sanitizedPath = rawPath
    .replace(/\.\./g, "")
    .replace(/^\/+/, "")
    .trim();

  if (!sanitizedPath) {
    return null;
  }

  return {
    bucket,
    path: sanitizedPath,
  };
}

/**
 * Compares a stored database URL/path against a requested bucket and normalized object path.
 * Enforces exact bucket and normalized path equality (eliminates partial/substring matching attacks).
 *
 * @param {string} storedUrlOrPath - Stored URL or object path from database
 * @param {string} targetBucket - Requested storage bucket name
 * @param {string} targetPath - Requested normalized storage object path
 * @returns {boolean}
 */
function matchesStorageObject(storedUrlOrPath, targetBucket, targetPath) {
  if (!storedUrlOrPath || typeof storedUrlOrPath !== "string") return false;
  if (!targetBucket || !targetPath) return false;

  const parsed = parseStorageUrl(storedUrlOrPath);
  if (!parsed) return false;

  return (
    parsed.bucket.toLowerCase() === targetBucket.toLowerCase() &&
    parsed.path === targetPath
  );
}

/**
 * Validates file buffer size and authenticates file signatures (magic bytes).
 * Does not trust file extensions, URLs, or caller-supplied MIME labels alone.
 *
 * @param {Buffer} buffer - Raw file bytes
 * @param {string|object} [mimeTypeOrOptions] - Optional MIME type or options object
 * @param {object} [maybeOptions] - Additional options
 * @returns {{ valid: boolean, error?: string, detectedType?: string }}
 */
function validateFileBuffer(buffer, mimeTypeOrOptions, maybeOptions = {}) {
  let mimeType = null;
  let options = {};

  if (typeof mimeTypeOrOptions === "string") {
    mimeType = mimeTypeOrOptions;
    options = maybeOptions || {};
  } else if (typeof mimeTypeOrOptions === "object" && mimeTypeOrOptions !== null) {
    options = mimeTypeOrOptions;
    mimeType = options.mimeType || null;
  }

  const maxBytes = options.maxBytes || options.maxSize || 15 * 1024 * 1024;
  const allowedMimes = options.allowedMimes || options.allowedMimeTypes || (mimeType ? [mimeType] : null);
  const requirePdf = options.requirePdf || (allowedMimes && allowedMimes.includes("application/pdf"));

  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { valid: false, error: "File buffer is empty or missing" };
  }

  if (buffer.length > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    return { valid: false, error: `File size exceeds maximum allowed size of ${maxMb || 1}MB` };
  }

  // Detect and verify actual magic bytes / file signatures
  let detectedType = null;
  if (buffer.length >= 4 && buffer.slice(0, 4).toString("ascii") === "%PDF") {
    detectedType = "application/pdf";
  } else if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    detectedType = "image/jpeg";
  } else if (buffer.length >= 8 && buffer[0] === 0x89 && buffer.slice(1, 4).toString("ascii") === "PNG") {
    detectedType = "image/png";
  }

  // If PDF is required (as in resume parsing), strictly verify %PDF magic bytes
  if (requirePdf && detectedType !== "application/pdf") {
    return {
      valid: false,
      error: "Invalid file content: file is not a valid PDF document (missing %PDF signature)",
    };
  }

  if (allowedMimes && Array.isArray(allowedMimes)) {
    if (!detectedType || !allowedMimes.includes(detectedType.toLowerCase())) {
      return {
        valid: false,
        error: `Invalid file format or unsupported file type: ${detectedType || "unknown"}`,
      };
    }
  }

  return { valid: true, detectedType };
}

module.exports = {
  ALLOWED_STORAGE_BUCKETS,
  parseStorageUrl,
  matchesStorageObject,
  validateFileBuffer,
};
