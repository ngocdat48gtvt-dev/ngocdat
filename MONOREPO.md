# QuanLySuCo Web Monorepo

Giai doan 1: chi di chuyen source, khong sua logic/UI.

```
apps/
  dieu-hanh/   <- dieu-hanh-web
  nhat-ky/     <- nhat-ky-tuan-duong
  website/     <- website (giu .git rieng -> Vercel: cd apps/website && git push)
packages/      <- (trong)
scripts/
```

Rollback: `git revert 7fb7d3b` hoac doi ten folder ve:
- apps/dieu-hanh -> dieu-hanh-web
- apps/nhat-ky -> nhat-ky-tuan-duong
- apps/website -> website

Luu y deploy: `apps/website/build-dieu-hanh.bat` van tro den `..\dieu-hanh-web` (chua cap nhat — giai doan sau).
