module.exports = {
  apps: [
    {
      name: 'webapp-frontend',
      script: 'npx',
      args: 'http-server . -p 3000 --cors',
      cwd: '/Users/johnny/Code/SmartScrape-Full-Stack',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        PWD: '/Users/johnny/Code/SmartScrape-Full-Stack'
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '1G',
      error_file: '/Users/johnny/Code/SmartScrape-Full-Stack/logs/err-frontend.log',
      out_file: '/Users/johnny/Code/SmartScrape-Full-Stack/logs/out-frontend.log',
      log_file: '/Users/johnny/Code/SmartScrape-Full-Stack/logs/combined-frontend.log',
      time: true
    },
    {
      name: 'webapp-backend',
      script: './start_service.sh',
      cwd: '/Users/johnny/Code/SmartScrape-Full-Stack',
      env: {
        NODE_ENV: 'development',
        PYTHONPATH: '/Users/johnny/Code/SmartScrape-Full-Stack',
        PWD: '/Users/johnny/Code/SmartScrape-Full-Stack'
      },
      interpreter: 'bash',
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '1G',
      error_file: '/Users/johnny/Code/SmartScrape-Full-Stack/logs/err-backend.log',
      out_file: '/Users/johnny/Code/SmartScrape-Full-Stack/logs/out-backend.log',
      log_file: '/Users/johnny/Code/SmartScrape-Full-Stack/logs/combined-backend.log',
      time: true
    }
  ]
}