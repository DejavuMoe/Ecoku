# 常見問題與排錯指南

---

## 1. 登入與權限問題

### Q: 為什麼管理後台重新整理後需要重新登入？
**答**：Ecoku 採用高安全性的記憶體會話設計，Bearer Token 僅存在於記憶體中，絕不寫入瀏覽器儲存。

### Q: 啟動容器提示 `permission denied`？
**答**：修正宿主機目錄擁有者為 `10001:10001`：
```bash
sudo chown -R 10001:10001 ~/Ecoku/data ~/Ecoku/app/logs ~/Ecoku/app/config.yaml
sudo chmod 750 ~/Ecoku/data ~/Ecoku/app/logs
sudo chmod 640 ~/Ecoku/app/config.yaml
```

---

## 2. 人機驗證故障恢復

### Q: 驗證碼配置錯誤導致無法登入？
**答**：使用 CLI 救磚命令：
```bash
sudo docker compose down
sudo docker compose run --rm --no-deps ecoku captcha disable
sudo docker compose up -d
```
