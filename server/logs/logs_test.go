package logs

import (
	"bytes"
	"io"
	"os"
	"path/filepath"
	"testing"
)

func TestNewWriterStdoutPaths(t *testing.T) {
	for _, path := range []string{"", "stdout", "STDOUT", "-", "/dev/stdout", "  stdout  "} {
		writer, _ := newWriter(path)
		if writer != os.Stdout {
			t.Fatalf("path %q did not use stdout: %#v", path, writer)
		}
	}
}

func TestNewWriterDuplicatesStdoutAndRotatingFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "ecoku.log")
	writer, closer := newWriter(path)
	if _, err := io.WriteString(writer, "compose-follow-line\n"); err != nil {
		t.Fatalf("write log: %v", err)
	}
	if err := closer.Close(); err != nil {
		t.Fatalf("close log file: %v", err)
	}
	body, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read rotated file: %v", err)
	}
	if !bytes.Contains(body, []byte("compose-follow-line")) {
		t.Fatalf("file log missing probe line: %q", body)
	}
}
