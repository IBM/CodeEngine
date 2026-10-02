// Package log provides structured JSON logging using the standard library's slog.
package log

import (
	"log/slog"
	"os"
	"time"
)

var logger *slog.Logger

func init() {
	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})
	logger = slog.New(handler)
}

// Info logs an informational event with optional fields.
// Fields may be passed as a map[string]interface{} (single arg) or as
// alternating key/value pairs matching the slog variadic API.
func Info(event string, fields ...any) {
	args := buildArgs(event, fields...)
	logger.Info("", args...)
}

// Warn logs a warning event with optional fields.
func Warn(event string, fields ...any) {
	args := buildArgs(event, fields...)
	logger.Warn("", args...)
}

// Error logs an error event. err may be nil.
func Error(event string, err error, fields ...any) {
	base := []any{"event", event, "ts", time.Now().UTC().Format(time.RFC3339)}
	if err != nil {
		base = append(base, "error", err.Error())
	}
	base = append(base, flattenFields(fields...)...)
	logger.Error("", base...)
}

// Debug logs a debug event with optional fields.
func Debug(event string, fields ...any) {
	args := buildArgs(event, fields...)
	logger.Debug("", args...)
}

// buildArgs prepends the standard event/ts keys and flattens any map or
// key/value fields passed by callers.
func buildArgs(event string, fields ...any) []any {
	base := []any{"event", event, "ts", time.Now().UTC().Format(time.RFC3339)}
	return append(base, flattenFields(fields...)...)
}

// flattenFields accepts either a single map[string]interface{} argument
// (legacy call-site convention used in some handlers) or alternating
// key/value pairs (slog convention).
func flattenFields(fields ...any) []any {
	if len(fields) == 1 {
		if m, ok := fields[0].(map[string]interface{}); ok {
			out := make([]any, 0, len(m)*2)
			for k, v := range m {
				out = append(out, k, v)
			}
			return out
		}
	}
	return fields
}
