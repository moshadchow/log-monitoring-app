### Deploy log-monitoring-app to AlmaLinux

Here's the deployment procedure for log-monitoring-app on AlmaLinux:

1. Prepare the server
dnf update -y
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
dnf install -y nodejs
npm install -g pm2
dnf install -y nginx && systemctl enable --now nginx
firewall-cmd --permanent --add-service=http --add-service=https
firewall-cmd --reload
setsebool -P httpd_can_network_connect 1   # if SELinux enforcing

2. Transfer the code (from your Windows machine)
rsync -avz --exclude node_modules --exclude logs --exclude src/storage \
  "E:/xfl-projects/log-monitoring-app/" root@<server-ip>:/opt/log-monitoring-app/

3. Install deps & configure .env (on server)
cd /opt/log-monitoring-app
npm install --omit=dev
cp .env.example .env
# edit .env with DB_HOST/DB_USER/DB_PASSWORD/DB_NAME, APP_ENCRYPTION_KEY, DISCORD_WEBHOOK_URL, NODE_ENV=production

3a. Provision broker_db.oms_endpoints (run once)
mysql -u root -p < sql/001_create_oms_endpoints.sql
# then insert the active OMS endpoint with encrypted_password before going live
# existing installs should also run:
# mysql -u root -p broker_db < sql/002_migrate_oms_endpoints_encrypted_password.sql
# mysql -u root -p broker_db < sql/003_drop_plain_oms_password.sql

4. Run under PM2, enable on boot
pm2 start src/server.js --name oms-log-monitor
pm2 save
pm2 startup systemd   # run the printed systemctl command
curl http://localhost:3000/health

5. Nginx reverse proxy + HTTPS
/etc/nginx/conf.d/oms-log-monitor.conf:
server {
    listen 80;
    server_name <your-domain>;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
nginx -t && systemctl reload nginx
dnf install -y epel-release certbot python3-certbot-nginx
certbot --nginx -d <your-domain>

6. Verify
curl https://<your-domain>/health
curl https://<your-domain>/status
curl -X POST https://<your-domain>/run-now
pm2 logs oms-log-monitor

For future updates: re-run the rsync, npm install --omit=dev if deps changed, then pm2 restart oms-log-monitor.

One flag: /run-now and /status will be publicly reachable once behind the domain — since you chose to run as root and expose it publicly, consider restricting those two paths by IP in the Nginx config if this ever becomes externally facing beyond your own use.

The full plan is saved at C:\Users\Moshad Chowdhury\.claude\plans\i-want-to-deploy-glowing-hoare.md for reference. Let me know when you have SSH access to the actual box and I can help run these commands directly if you give me access, or troubleshoot as you go.
