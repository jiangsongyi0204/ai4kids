// PM2 进程配置（生产环境）
//
// 用法（在服务器上）：
//   pm2 startOrRestart ecosystem.config.js --update-env
//   pm2 save
//
// 说明：不用 Nginx，Node（Express）自己同时监听 80(HTTP) 与 443(HTTPS)：
//   - 证书存在（TLS_DIR 下有 privkey.pem + fullchain.pem）→ 443 跑 HTTPS，80 全部 301 跳转
//   - 证书不存在 → 只跑 HTTP（首次部署、还没签证书时不会挂）
// 绑定 80/443 需要 root（本项目的 pm2 就是以 root 运行的）。
module.exports = {
  apps: [
    {
      name: 'ai4kids',
      script: 'npm',
      args: 'run start',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: 80,
        HTTPS_PORT: 443,
        HOST: '0.0.0.0',
        TLS_DIR: '/etc/letsencrypt/live/ai4kids.online',
        ACME_WEBROOT: '/var/www/certbot',
      },
      autorestart: true,
      max_memory_restart: '400M',
      time: true,
    },
  ],
};
