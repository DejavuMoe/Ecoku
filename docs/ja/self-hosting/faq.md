# よくある質問とトラブル解決

---

## 1. 認証と権限

### Q: 管理画面をリロードするとログアウトされるのはなぜですか？
**A**: Ecoku は最高レベルのセキュリティを確保するため、**インメモリセッションモデル**を採用しています。トークンはブラウザのストレージには保存されません。

### Q: コンテナ起動時に `permission denied` と表示される
**A**: 権限を `10001:10001` に修正してください：
```bash
sudo chown -R 10001:10001 ~/Ecoku/data ~/Ecoku/app/logs ~/Ecoku/app/config.yaml
sudo chmod 750 ~/Ecoku/data ~/Ecoku/app/logs
sudo chmod 640 ~/Ecoku/app/config.yaml
```

---

## 2. CAPTCHA 救済

### Q: CAPTCHA の設定ミスで管理画面に入れなくなった
**A**: CLI コマンドで CAPTCHA を無効化してください：
```bash
sudo docker compose down
sudo docker compose run --rm --no-deps ecoku captcha disable
sudo docker compose up -d
```
