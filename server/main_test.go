package main

import (
	"bytes"
	"strings"
	"testing"

	"golang.org/x/crypto/bcrypt"
)

func TestRunPasswordHashReadsPasswordFromStandardInput(t *testing.T) {
	const password = "correct horse battery staple"
	var output bytes.Buffer
	if err := runPasswordHash(strings.NewReader(password+"\n"), &output); err != nil {
		t.Fatalf("hash password: %v", err)
	}
	hash := strings.TrimSpace(output.String())
	if strings.Contains(hash, password) {
		t.Fatal("hash output contains plaintext password")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err != nil {
		t.Fatalf("compare generated hash: %v", err)
	}
}

func TestRunPasswordHashRejectsEmptyPassword(t *testing.T) {
	var output bytes.Buffer
	if err := runPasswordHash(strings.NewReader("\n"), &output); err == nil {
		t.Fatal("empty password was accepted")
	}
	if output.Len() != 0 {
		t.Fatal("empty password produced output")
	}
}
