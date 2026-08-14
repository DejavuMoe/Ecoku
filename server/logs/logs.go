package logs

import (
	"ecoku-server/config"
	"gopkg.in/natefinch/lumberjack.v2"
	"log"
)

// InitLogger 初始化日志系统
func InitLogger() {
	// 设置 lumberjack 的日志轮转参数
	logFile := &lumberjack.Logger{
		Filename:   config.LogFilePath, // 日志文件路径
		MaxSize:    500,                // 每个日志文件的最大大小（兆字节）
		MaxBackups: 3,                  // 保留旧日志文件的最大数量
		MaxAge:     28,                 // 保留旧日志文件的最大天数
		Compress:   true,               // 是否压缩旧日志文件
	}
	// 将日志输出设置为 lumberjack Logger
	log.SetOutput(logFile)
}
