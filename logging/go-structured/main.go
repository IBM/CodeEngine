package main

import (
	"errors"
	"log/slog"
	"os"
	"runtime/debug"
)

func main() {
	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		// Remove time and rename msg->message
		ReplaceAttr: func(groups []string, attr slog.Attr) slog.Attr {
			// Drop the time attribute
			if attr.Key == slog.TimeKey {
				return slog.Attr{} // empty => removed
			}
			// Rename msg to message
			if attr.Key == slog.MessageKey {
				return slog.String("message", attr.Value.String())
			}
			return attr
		},
	})
	logger := slog.New(handler)

	// Expect to be rendered as INFO level log message
	logger.Info("This is a structured log message")

	// Expect to be rendered as DEBUG level log message
	logger.Debug("This is a structured log message")

	// Expect to be rendered as WARN level log message
	logger.Warn("This is a structured log message")

	// Expect to be rendered as ERROR level log message
	logger.Error("This is a structured log message")

	// Expect to be rendered as DEBUG level log message. The extra key is available as a searchable, filterable field
	logger.Debug("A structured log entry that contains an extra key",
		slog.String("extra_key", "extra_value"),
	)

	// Expect to be rendered as INFO level log message. The additional JSON struct is available as a searchable, filterable fields
	logger.Info("A structured log entry that carries a ton of additional fields",
		slog.String("requestId", "some-request-id"),
		slog.String("userId", "user-123456"),
		slog.String("action", "test"),
		slog.Group("metadata",
			slog.String("foo", "bar"),
		),
	)

	// Multi-line example. Expect to be rendered in a single log message
	logger.Info(`Multi-line log sample:
	Line 1: initialization started
	Line 2: loading modules
	Line 3: modules loaded
	Line 4: entering main loop\nEnd of sample`)

	// Error logging. The error stack trace is rendered in a single log message (see field stack)
	err := errors.New("boom!")
	logger.Error("An error occurred",
		slog.Any("err", err),
		slog.String("stack", string(debug.Stack())),
	)
}
