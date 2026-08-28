// Package log provides structured logging using the standard library's slog.
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
func Info(event string, fields ...any) {
	args := append([]any{"event", event, "ts", time.Now().UTC().Format(time.RFC3339)}, fields...)
	logger.Info("", args...)
}

// Error logs an error event with optional fields.
func Error(event string, err error, fields ...any) {
	args := []any{"event", event, "ts", time.Now().UTC().Format(time.RFC3339)}
	if err != nil {
		args = append(args, "error", err.Error())
	}
	args = append(args, fields...)
	logger.Error("", args...)
}

// Warn logs a warning event with optional fields.
func Warn(event string, fields ...any) {
	args := append([]any{"event", event, "ts", time.Now().UTC().Format(time.RFC3339)}, fields...)
	logger.Warn("", args...)
}

// Debug logs a debug event with optional fields.
func Debug(event string, fields ...any) {
	args := append([]any{"event", event, "ts", time.Now().UTC().Format(time.RFC3339)}, fields...)
	logger.Debug("", args...)
}
