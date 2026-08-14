package main

import (
	"context"
	"ecoku-server/config"
	"ecoku-server/importer"
	"ecoku-server/logs"
	"ecoku-server/model"
	"ecoku-server/notifications"
	"ecoku-server/routes"
	"flag"
	"fmt"
	"log"
	"os"
)

func main() {
	if len(os.Args) > 1 && os.Args[1] == "import-twikoo" {
		if err := runTwikooImport(os.Args[2:]); err != nil {
			log.Fatalf("Twikoo 导入失败: %v", err)
		}
		return
	}
	// 初始化配置文件
	config.InitConfigFile()
	// 初始化日志系统
	logs.InitLogger()
	// 初始化数据库
	model.InitDatabase()
	if err := notifications.ValidateStoredSecrets(); err != nil {
		log.Fatalf("通知凭据校验失败: %v", err)
	}
	if err := notifications.StartWorker(context.Background()); err != nil {
		log.Fatalf("通知队列初始化失败: %v", err)
	}
	// 初始化路由
	routes.InitRouter()
}

func runTwikooImport(arguments []string) error {
	flags := flag.NewFlagSet("import-twikoo", flag.ContinueOnError)
	siteID := flags.String("site", "", "目标站点 ID")
	filePath := flags.String("file", "", "Twikoo JSON 导出文件")
	dryRun := flags.Bool("dry-run", false, "只验证并回滚")
	if err := flags.Parse(arguments); err != nil {
		return err
	}
	if *siteID == "" || *filePath == "" {
		return fmt.Errorf("必须提供 --site 和 --file")
	}
	config.InitConfigFile()
	logs.InitLogger()
	model.InitDatabase()
	file, err := os.Open(*filePath)
	if err != nil {
		return fmt.Errorf("打开导出文件: %w", err)
	}
	defer file.Close()
	result, err := importer.ImportTwikoo(context.Background(), model.DB, file, importer.TwikooImportOptions{
		SiteID: *siteID,
		DryRun: *dryRun,
	})
	if err != nil {
		return err
	}
	log.Printf("Twikoo 导入%s：评论=%d 根评论=%d 回复=%d 页面=%d 邮箱=%d 网站=%d 缺失父记录=%d",
		map[bool]string{true: "预检通过", false: "完成"}[*dryRun], result.Imported, result.Roots,
		result.Replies, result.DistinctPages, result.Emails, result.Websites, result.Orphaned)
	return nil
}
