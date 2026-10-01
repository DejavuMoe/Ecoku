package logs

import (
	"io"
	"log"
	"os"
	"strings"

	"ecoku-server/config"
	"gopkg.in/natefinch/lumberjack.v2"
)

const (
	fileMaxSizeMB  = 10
	fileMaxBackups = 5
	fileMaxAgeDays = 28
)

type nopCloser struct{}

func (nopCloser) Close() error { return nil }

// InitLogger sends process logs to stdout so `docker compose logs` can follow
// them. A regular log_path also keeps a lumberjack-rotated file copy.
func InitLogger() {
	writer, _ := newWriter(config.LogFilePath)
	log.SetOutput(writer)
}

func newWriter(path string) (io.Writer, io.Closer) {
	if isStdoutPath(path) {
		return os.Stdout, nopCloser{}
	}
	file := &lumberjack.Logger{
		Filename:   path,
		MaxSize:    fileMaxSizeMB,
		MaxBackups: fileMaxBackups,
		MaxAge:     fileMaxAgeDays,
		Compress:   true,
	}
	return io.MultiWriter(os.Stdout, file), file
}

func isStdoutPath(path string) bool {
	switch strings.ToLower(strings.TrimSpace(path)) {
	case "", "-", "stdout", "/dev/stdout":
		return true
	default:
		return false
	}
}
