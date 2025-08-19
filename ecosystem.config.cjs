module.exports = {
  apps: [
    {
      name: 'webapp',
      script: 'npx',
      args: 'wrangler pages dev dist --d1=webapp-production --local --ip 0.0.0.0 --port 3000',
      cwd: '/tmp/SmartScrape-Full-Stack',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        PWD: '/tmp/SmartScrape-Full-Stack'
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '1G',
      error_file: '/tmp/SmartScrape-Full-Stack/logs/err.log',
      out_file: '/tmp/SmartScrape-Full-Stack/logs/out.log',
      log_file: '/tmp/SmartScrape-Full-Stack/logs/combined.log',
      time: true
    }
  ]
}