package model

import (
	"ecoku-server/config"
	"fmt"
	"log"
	"strings"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

const sqliteBusyTimeoutMilliseconds = 5000

// InitDatabase opens the configured SQLite3 database and only bootstraps a
// truly empty database. Existing unversioned or outdated databases are rejected
// and must be backed up before an explicitly authorized rebuild.
func InitDatabase() error {
	database, err := OpenConfiguredDatabase()
	if err != nil {
		return fmt.Errorf("打开数据库: %w", err)
	}
	if err := PrepareDatabaseForStartup(database); err != nil {
		_ = CloseSQLiteDatabase(database)
		return err
	}
	DB = database
	log.Printf("数据库初始化成功，使用 SQLite3")
	return nil
}

// OpenConfiguredDatabase opens only SQLite3. P2 intentionally removed the
// former MySQL configuration and driver.
func OpenConfiguredDatabase() (*gorm.DB, error) {
	sqliteConfig := config.GetSQLiteConfig()
	if sqliteConfig == nil || strings.TrimSpace(sqliteConfig.Path) == "" {
		return nil, fmt.Errorf("SQLite 配置不完整")
	}
	return OpenSQLiteDatabase(sqliteConfig.Path)
}

// OpenSQLiteDatabase is exported for import commands and isolated tests.
func OpenSQLiteDatabase(path string) (*gorm.DB, error) {
	if strings.TrimSpace(path) == "" {
		return nil, fmt.Errorf("SQLite 数据库路径不能为空")
	}
	// database/sql may discard a connection after a canceled transaction.
	// Driver DSN pragmas run on EVERY replacement connection, unlike startup
	// Exec calls. Append last so configured URI parameters cannot undo them.
	separator := "?"
	if strings.Contains(path, "?") {
		separator = "&"
	}
	dsn := path + separator + "_pragma=foreign_keys(1)&_pragma=synchronous(1)&_pragma=busy_timeout(5000)"
	database, err := gorm.Open(sqlite.Open(dsn), databaseGORMConfig())
	if err != nil {
		return nil, err
	}
	if err := configureSQLiteConnection(database); err != nil {
		if sqlDatabase, openErr := database.DB(); openErr == nil {
			_ = sqlDatabase.Close()
		}
		return nil, err
	}
	return database, nil
}

func configureSQLiteConnection(database *gorm.DB) error {
	sqlDatabase, err := database.DB()
	if err != nil {
		return fmt.Errorf("读取 SQLite 连接: %w", err)
	}
	// Most SQLite PRAGMA settings are connection-local. Keeping one connection
	// makes foreign-key enforcement, busy waiting and durability settings
	// deterministic for every request and import. WAL still lets readers in
	// other processes proceed while this process writes, without widening the
	// unmeasured in-process concurrency boundary for RC3.
	sqlDatabase.SetMaxOpenConns(1)
	sqlDatabase.SetMaxIdleConns(1)
	if err := database.Exec("PRAGMA busy_timeout = 5000").Error; err != nil {
		return fmt.Errorf("设置 SQLite 忙等待: %w", err)
	}
	var journalMode string
	if err := database.Raw("PRAGMA journal_mode = WAL").Scan(&journalMode).Error; err != nil {
		return fmt.Errorf("启用 SQLite WAL: %w", err)
	}
	if !strings.EqualFold(journalMode, "wal") {
		return fmt.Errorf("SQLite WAL 未启用: journal_mode=%q", journalMode)
	}
	if err := database.Exec("PRAGMA synchronous = NORMAL").Error; err != nil {
		return fmt.Errorf("设置 SQLite 同步级别: %w", err)
	}
	if err := database.Exec("PRAGMA foreign_keys = ON").Error; err != nil {
		return fmt.Errorf("启用 SQLite 外键: %w", err)
	}

	var busyTimeout, synchronous, foreignKeys int
	if err := database.Raw("PRAGMA busy_timeout").Scan(&busyTimeout).Error; err != nil {
		return fmt.Errorf("验证 SQLite 忙等待: %w", err)
	}
	if busyTimeout != sqliteBusyTimeoutMilliseconds {
		return fmt.Errorf("SQLite 忙等待未生效: busy_timeout=%d", busyTimeout)
	}
	if err := database.Raw("PRAGMA synchronous").Scan(&synchronous).Error; err != nil {
		return fmt.Errorf("验证 SQLite 同步级别: %w", err)
	}
	if synchronous != 1 {
		return fmt.Errorf("SQLite 同步级别未设为 NORMAL: synchronous=%d", synchronous)
	}
	if err := database.Raw("PRAGMA foreign_keys").Scan(&foreignKeys).Error; err != nil {
		return fmt.Errorf("验证 SQLite 外键: %w", err)
	}
	if foreignKeys != 1 {
		return fmt.Errorf("SQLite 外键未启用")
	}
	return nil
}

// CloseDatabase checkpoints WAL after request and background workers have
// stopped, then closes the process-wide connection pool. This makes a stopped
// container safe to back up as one SQLite database file.
func CloseDatabase() error {
	if DB == nil {
		return nil
	}
	database := DB
	if err := CloseSQLiteDatabase(database); err != nil {
		return err
	}
	DB = nil
	return nil
}

// CloseSQLiteDatabase is exported for isolated command paths and tests.
func CloseSQLiteDatabase(database *gorm.DB) error {
	if database == nil {
		return nil
	}
	// Closing the pool must still be attempted if checkpointing reports an
	// error. Otherwise a failed shutdown path can leave the database handle
	// open and make an operator's subsequent cold backup unsafe.
	var checkpointErr error
	var checkpoint struct {
		Busy         int `gorm:"column:busy"`
		Log          int `gorm:"column:log"`
		Checkpointed int `gorm:"column:checkpointed"`
	}
	if err := database.Raw("PRAGMA wal_checkpoint(TRUNCATE)").Scan(&checkpoint).Error; err != nil {
		checkpointErr = fmt.Errorf("执行 SQLite WAL checkpoint: %w", err)
	} else if checkpoint.Busy != 0 {
		checkpointErr = fmt.Errorf("SQLite WAL checkpoint 忙碌: log=%d checkpointed=%d", checkpoint.Log, checkpoint.Checkpointed)
	}
	sqlDatabase, err := database.DB()
	if err != nil {
		if checkpointErr != nil {
			return fmt.Errorf("%v；读取 SQLite 连接: %w", checkpointErr, err)
		}
		return fmt.Errorf("读取 SQLite 连接: %w", err)
	}
	if err := sqlDatabase.Close(); err != nil {
		if checkpointErr != nil {
			return fmt.Errorf("%v；关闭 SQLite 连接: %w", checkpointErr, err)
		}
		return fmt.Errorf("关闭 SQLite 连接: %w", err)
	}
	return checkpointErr
}

func databaseGORMConfig() *gorm.Config {
	// SQL errors can contain bound comment bodies or email addresses. API
	// handlers return generic errors, so SQL logging stays disabled by default.
	return &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)}
}
