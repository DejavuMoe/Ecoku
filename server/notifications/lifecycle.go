package notifications

import "context"

var commentLifecycleGate = make(chan struct{}, 1)

// WithCommentLifecycle orders tombstone commits and the final delivery check/send.
// Acquire before opening a deletion transaction; never perform external I/O in it.
// ponytail: one process/worker, global gate also delays unrelated deletions behind
// a send (at most its 20s delivery deadline; Telegram still has its 15s timeout).
// This bounds one active send, not a queue of deletions. Waiters honor ctx;
// use finer-grained coordination only if measured contention
// requires it. Multiple worker processes would need cross-process coordination.
func WithCommentLifecycle(ctx context.Context, action func() error) error {
	select {
	case commentLifecycleGate <- struct{}{}:
		defer func() { <-commentLifecycleGate }()
	case <-ctx.Done():
		return ctx.Err()
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	return action()
}
