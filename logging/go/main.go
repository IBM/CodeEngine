package main

import (
	"os"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

func init() {
	stdout := zapcore.AddSync(os.Stdout)

	level := zap.NewAtomicLevelAt(zap.InfoLevel)

	encoderCfg := zap.NewProductionEncoderConfig()
	encoderCfg.TimeKey = "timestamp"
	encoderCfg.EncodeTime = zapcore.ISO8601TimeEncoder
	encoderCfg.MessageKey = "message"
	consoleEncoder := zapcore.NewJSONEncoder(encoderCfg)

	zap.ReplaceGlobals(zap.New(zapcore.NewCore(consoleEncoder, stdout, level)))
}

func main() {
	logger := zap.L()

	logger.Info("This is a simple log message")

	logger.Info("A log entry that adds another key-value pair",
		zap.String("extra_key", "extra_value"),
	)

}
