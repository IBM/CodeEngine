package main

import (
	"log/slog"
	"os"
)

func init() {

	logHandlerOptions := &slog.HandlerOptions{

		Level: slog.Level(0),
		ReplaceAttr: func(groups []string, a slog.Attr) slog.Attr {

			if a.Key == "msg" {
				return slog.Attr{
					Key:   "message",
					Value: a.Value,
				}
			}
			if a.Key == "time" {
				return slog.Attr{
					Key:   "timestamp",
					Value: a.Value,
				}
			}
			return a

		},
	}
	handler := slog.NewJSONHandler(os.Stdout, logHandlerOptions)

	slog.SetDefault(slog.New(handler))
}

func main() {
	logger := slog.With()

	logger.Info("This is a simple log message")

	logger.Info("A log entry that adds another key-value pair",
		"extra_key", "extra_value",
	)

}
