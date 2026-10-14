export const errorMiddleware = (err, req, res, next) => {
  console.error(`[error] ${req.method} ${req.originalUrl}`, err);

  if (res.headersSent) {
    return next(err);
  }

  const isValidationError =
    err.name === "ValidationError" || err.name === "CastError";
  const isMalformedJson = err.type === "entity.parse.failed";
  const isMulterError = err.name === "MulterError";
  const status =
    err.code === 11000
      ? 409
      : isMulterError
        ? err.code === "LIMIT_FILE_SIZE"
          ? 413
          : 400
        : isValidationError || isMalformedJson
          ? 400
          : Number.isInteger(err.status) && err.status >= 400 && err.status < 500
            ? err.status
            : 500;

  const multerMessage =
    err.code === "LIMIT_FILE_SIZE"
      ? "File is too large (max 5MB)"
      : err.message || "Upload failed";

  res.status(status).json({
    message:
      status === 500
        ? "Internal server error"
        : isMulterError
          ? multerMessage
          : err.message || "Invalid request",
  });
};