package model

import (
	"context"
	"database/sql"
	"fmt"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"

	"github.com/libtnb/sqlite"
	"gorm.io/gorm"
)

// SQLite in WAL mode lets readers proceed while the single writer connection
// commits. Public reads use this pool so they no longer queue behind each other
// or behind writes on the one writer connection.
const maxReadConnections = 4

type readPool struct {
	epoch  uint64
	owner  *gorm.DB
	reader *gorm.DB
	probe  *sql.Conn
	// probe is a single connection; data_version is connection-local.
	probeMu sync.Mutex
	probeDB *gorm.DB
}

var (
	readPoolMu    sync.RWMutex
	activePool    *readPool
	readPoolEpoch atomic.Uint64
)

// DataStamp identifies a committed database state for one read pool. Stamps
// from different pools never compare equal, so caches cannot outlive a pool.
type DataStamp struct {
	pool    uint64
	version int64
}

// ReadDB returns the read-only pool that belongs to the current DB. Callers
// that only read use it; when no pool is attached (CLI paths and tests that
// swap DB), it falls back to DB so behavior stays identical.
func ReadDB() *gorm.DB {
	readPoolMu.RLock()
	pool := activePool
	readPoolMu.RUnlock()
	if pool != nil && pool.owner == DB && DB != nil {
		return pool.reader
	}
	return DB
}

// probeDataVersion reads SQLite's data_version on a dedicated connection. The
// value changes after any other connection, in this or another process,
// commits a change. ok is false when no read pool is attached, in which case
// callers must not cache.
func probeDataVersion(ctx context.Context) (DataStamp, bool, error) {
	readPoolMu.RLock()
	pool := activePool
	readPoolMu.RUnlock()
	if pool == nil || pool.owner != DB || DB == nil {
		return DataStamp{}, false, nil
	}
	pool.probeMu.Lock()
	defer pool.probeMu.Unlock()
	var version int64
	if err := pool.probe.QueryRowContext(ctx, "PRAGMA data_version").Scan(&version); err != nil {
		return DataStamp{}, false, err
	}
	return DataStamp{pool: pool.epoch, version: version}, true, nil
}

// AttachReadPool opens the read pool and data_version probe for path and binds
// them to writer. It is exported for isolated tests.
func AttachReadPool(writer *gorm.DB, path string) error {
	pool, err := openReadPool(writer, path)
	if err != nil {
		return err
	}
	readPoolMu.Lock()
	previous := activePool
	activePool = pool
	readPoolMu.Unlock()
	return previous.close()
}

// DetachReadPool closes the attached read pool, if any.
func DetachReadPool() error {
	readPoolMu.Lock()
	previous := activePool
	activePool = nil
	readPoolMu.Unlock()
	return previous.close()
}

func openReadPool(writer *gorm.DB, path string) (*readPool, error) {
	if strings.TrimSpace(path) == "" {
		return nil, fmt.Errorf("SQLite 数据库路径不能为空")
	}
	separator := "?"
	if strings.Contains(path, "?") {
		separator = "&"
	}
	// query_only rejects writes on these connections; foreign keys and
	// synchronous only matter for writes.
	dsn := path + separator + "_pragma=busy_timeout(5000)&_pragma=query_only(1)"
	connections := min(runtime.GOMAXPROCS(0), maxReadConnections)
	reader, err := gorm.Open(sqlite.Open(dsn), databaseGORMConfig())
	if err != nil {
		return nil, fmt.Errorf("打开 SQLite 只读连接池: %w", err)
	}
	readerSQL, err := reader.DB()
	if err != nil {
		return nil, fmt.Errorf("读取 SQLite 只读连接池: %w", err)
	}
	readerSQL.SetMaxOpenConns(connections)
	readerSQL.SetMaxIdleConns(connections)
	readerSQL.SetConnMaxIdleTime(0)
	readerSQL.SetConnMaxLifetime(0)

	probeDB, err := gorm.Open(sqlite.Open(dsn), databaseGORMConfig())
	if err != nil {
		_ = readerSQL.Close()
		return nil, fmt.Errorf("打开 SQLite 版本探针: %w", err)
	}
	probeSQL, err := probeDB.DB()
	if err != nil {
		_ = readerSQL.Close()
		return nil, fmt.Errorf("读取 SQLite 版本探针: %w", err)
	}
	probeSQL.SetMaxOpenConns(1)
	probeSQL.SetMaxIdleConns(1)
	probe, err := probeSQL.Conn(context.Background())
	if err != nil {
		_ = readerSQL.Close()
		_ = probeSQL.Close()
		return nil, fmt.Errorf("打开 SQLite 版本探针: %w", err)
	}
	var journalMode string
	if err := reader.Raw("PRAGMA journal_mode").Scan(&journalMode).Error; err != nil || !strings.EqualFold(journalMode, "wal") {
		_ = probe.Close()
		_ = readerSQL.Close()
		_ = probeSQL.Close()
		if err == nil {
			err = fmt.Errorf("journal_mode=%q", journalMode)
		}
		return nil, fmt.Errorf("SQLite 只读连接池需要 WAL: %w", err)
	}
	return &readPool{epoch: readPoolEpoch.Add(1), owner: writer, reader: reader, probe: probe, probeDB: probeDB}, nil
}

func (pool *readPool) close() error {
	if pool == nil {
		return nil
	}
	var errs []error
	pool.probeMu.Lock()
	if err := pool.probe.Close(); err != nil {
		errs = append(errs, err)
	}
	pool.probeMu.Unlock()
	if sqlDB, err := pool.probeDB.DB(); err == nil {
		if err := sqlDB.Close(); err != nil {
			errs = append(errs, err)
		}
	}
	if sqlDB, err := pool.reader.DB(); err == nil {
		if err := sqlDB.Close(); err != nil {
			errs = append(errs, err)
		}
	}
	if len(errs) > 0 {
		return fmt.Errorf("关闭 SQLite 只读连接池: %v", errs)
	}
	return nil
}
