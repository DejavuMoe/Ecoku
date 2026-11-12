package model

import (
	"context"
	"sync"
)

type dataStampKey struct{}

type dataStampSnapshot struct {
	stamp DataStamp
	ok    bool
}

// WithDataStamp reads data_version once and stores it in ctx, so every cache
// lookup in one request shares a single probe query. The stamp is read before
// any cached value is loaded, so a value can only be tagged with a stamp older
// than its data, never newer; such entries simply miss on the next request.
func WithDataStamp(ctx context.Context) (context.Context, error) {
	stamp, ok, err := probeDataVersion(ctx)
	if err != nil {
		return ctx, err
	}
	return context.WithValue(ctx, dataStampKey{}, dataStampSnapshot{stamp: stamp, ok: ok}), nil
}

// CurrentDataStamp returns the request's snapshot, probing when the request
// did not take one. ok is false when caching is unavailable.
func CurrentDataStamp(ctx context.Context) (DataStamp, bool, error) {
	if snapshot, found := ctx.Value(dataStampKey{}).(dataStampSnapshot); found {
		return snapshot.stamp, snapshot.ok, nil
	}
	return probeDataVersion(ctx)
}

// VersionedCache keeps values valid for a single DataStamp. Any committed
// write moves data_version, and the next store drops every older entry.
type VersionedCache[K comparable, V any] struct {
	mu         sync.Mutex
	stamp      DataStamp
	items      map[K]V
	maxEntries int
	maxCost    int
	cost       int
}

// NewVersionedCache bounds the number of entries. maxCost bounds the summed
// cost passed to Put; zero disables the cost bound.
func NewVersionedCache[K comparable, V any](maxEntries, maxCost int) *VersionedCache[K, V] {
	return &VersionedCache[K, V]{maxEntries: maxEntries, maxCost: maxCost}
}

func (cache *VersionedCache[K, V]) Get(stamp DataStamp, key K) (V, bool) {
	cache.mu.Lock()
	defer cache.mu.Unlock()
	var zero V
	if cache.items == nil || cache.stamp != stamp {
		return zero, false
	}
	value, ok := cache.items[key]
	return value, ok
}

func (cache *VersionedCache[K, V]) Put(stamp DataStamp, key K, value V, cost int) {
	cache.mu.Lock()
	defer cache.mu.Unlock()
	if cache.maxCost > 0 && cost > cache.maxCost {
		return
	}
	if cache.items == nil || cache.stamp != stamp || len(cache.items) >= cache.maxEntries ||
		(cache.maxCost > 0 && cache.cost+cost > cache.maxCost) {
		cache.items = make(map[K]V)
		cache.stamp = stamp
		cache.cost = 0
	}
	if _, exists := cache.items[key]; !exists {
		cache.cost += cost
	}
	cache.items[key] = value
}

// Cached loads key through cache when ctx carries a usable stamp.
func Cached[K comparable, V any](ctx context.Context, cache *VersionedCache[K, V], key K, load func() (V, error)) (V, error) {
	stamp, ok, err := CurrentDataStamp(ctx)
	if err != nil || !ok {
		return load()
	}
	if value, hit := cache.Get(stamp, key); hit {
		return value, nil
	}
	value, err := load()
	if err != nil {
		return value, err
	}
	cache.Put(stamp, key, value, 0)
	return value, nil
}
