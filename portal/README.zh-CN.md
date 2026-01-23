# TryStack Portal

最小化的 Portal 页面（“Try locally” 入口）。

## Scripts

```bash
npm install
npm run dev
```

```bash
npm run build
node dev.js --dist
```

## Repo hygiene

可上传到远程仓：

- `portal/index.html`
- `portal/src/**`
- `portal/build.js` / `portal/dev.js`
- `portal/package.json` / `portal/package-lock.json`

不可上传（本地生成/缓存）：

- `portal/node_modules/`
- `portal/dist/`
