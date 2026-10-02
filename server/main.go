package main

import (
	"bufio"
	"context"
	"ecoku-server/captcha"
	"ecoku-server/config"
	"ecoku-server/importer"
	"ecoku-server/model"
	"ecoku-server/notifications"
	"ecoku-server/routes"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"golang.org/x/crypto/bcrypt"
)

func main() {
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "import-twikoo":
			if err := runTwikooImport(os.Args[2:]); err != nil {
				log.Fatalf("Twikoo 导入失败: %v", err)
			}
			return
		case "hash-password":
			if err := runPasswordHash(os.Stdin, os.Stdout); err != nil {
				log.Fatalf("管理员密码哈希生成失败: %v", err)
			}
			return
		case "captcha":
			if err := runCaptchaCommand(os.Args[2:], os.Stdout); err != nil {
				log.Fatalf("CAPTCHA 运维命令失败: %v", err)
			}
			return
		}
	}
	// 初始化配置文件
	config.InitConfigFile()
	if err := config.ValidateAdmin(); err != nil {
		log.Fatalf("管理后台配置无效: %v", err)
	}
	// 服务日志写到 stdout，由 `docker compose logs` 查看。
	log.SetOutput(os.Stdout)
	if err := model.InitDatabase(); err != nil {
		log.Fatalf("数据库初始化失败: %v", err)
	}
	if err := notifications.ValidateStoredSecrets(); err != nil {
		log.Fatalf("通知凭据校验失败: %v", err)
	}
	if err := captcha.ValidateStoredSecrets(); err != nil {
		log.Fatalf("CAPTCHA 凭据校验失败: %v", err)
	}
	runtimeContext, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	worker, err := notifications.StartWorker(runtimeContext)
	if err != nil {
		log.Fatalf("通知队列初始化失败: %v", err)
	}
	// 初始化路由
	serverErr := routes.RunServer(runtimeContext)
	stop()
	worker.Wait()
	databaseErr := model.CloseDatabase()
	if serverErr != nil {
		log.Fatalf("HTTP 服务退出失败: %v", serverErr)
	}
	if databaseErr != nil {
		log.Fatalf("数据库关闭失败: %v", databaseErr)
	}
	log.Printf("Ecoku 已安全停止")
}

func runPasswordHash(reader io.Reader, writer io.Writer) error {
	password, err := bufio.NewReader(reader).ReadString('\n')
	if err != nil && err != io.EOF {
		return fmt.Errorf("读取密码: %w", err)
	}
	password = strings.TrimSuffix(strings.TrimSuffix(password, "\n"), "\r")
	if password == "" {
		return fmt.Errorf("密码不能为空")
	}
	if len(password) > 4096 {
		return fmt.Errorf("密码过长")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("生成 bcrypt 哈希: %w", err)
	}
	if _, err := fmt.Fprintln(writer, string(hash)); err != nil {
		return fmt.Errorf("输出哈希: %w", err)
	}
	return nil
}

func runCaptchaCommand(arguments []string, writer io.Writer) (resultErr error) {
	if len(arguments) != 1 || (arguments[0] != "disable" && arguments[0] != "status") {
		return fmt.Errorf("用法: captcha disable|status")
	}
	config.InitConfigFile()
	if err := model.InitDatabase(); err != nil {
		return err
	}
	defer func() {
		if err := model.CloseDatabase(); err != nil && resultErr == nil {
			resultErr = err
		}
	}()

	switch arguments[0] {
	case "disable":
		changed, err := captcha.Disable()
		if err != nil {
			return err
		}
		message := "CAPTCHA 已处于关闭状态"
		if changed {
			message = "CAPTCHA 已关闭；已保存的提供方配置和加密凭据均已保留"
		}
		_, err = fmt.Fprintln(writer, message)
		return err
	case "status":
		status, err := captcha.Describe()
		if err != nil {
			return err
		}
		_, err = fmt.Fprintln(writer, status)
		return err
	default:
		return fmt.Errorf("用法: captcha disable|status")
	}
}

func runTwikooImport(arguments []string) (resultErr error) {
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
	if err := model.InitDatabase(); err != nil {
		return err
	}
	defer func() {
		if err := model.CloseDatabase(); err != nil && resultErr == nil {
			resultErr = fmt.Errorf("关闭导入数据库: %w", err)
		}
	}()
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
