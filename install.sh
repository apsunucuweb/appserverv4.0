#!/bin/bash
# AppServer V6.2 - Otomatik GitHub Kurulum Betiği
# Bu betik yepyeni bir Ubuntu/Debian sunucusunda çalıştırılmalıdır.

if [ "$EUID" -ne 0 ]; then
  echo "Lütfen bu betiği root olarak çalıştırın (sudo bash install.sh <github_linki>)"
  exit 1
fi

REPO_URL=${1:-"https://github.com/apsunucuweb/appserverv4.0.git"}

echo "=========================================="
echo "     AppServer V6.2 Kurulumu Başlıyor     "
echo "=========================================="

echo "[1/4] Gelişmiş Sistem Gereksinimleri Yükleniyor (Sürebilir)..."
export DEBIAN_FRONTEND=noninteractive
echo "postfix postfix/main_mailer_type string 'Internet Site'" | debconf-set-selections
echo "postfix postfix/mailname string 'appserver.local'" | debconf-set-selections

apt-get update -y
# Panelin UFW, Fail2Ban, BIND9, MariaDB, Nginx, Postfix, Dovecot vb tüm özellikleri için gerekli altyapı:
apt-get install -yq curl wget git unzip vim ufw fail2ban nginx mariadb-server bind9 bind9utils bind9-doc postfix dovecot-imapd dovecot-pop3d certbot python3-certbot-nginx vsftpd php-fpm php-mysql composer

# Node.js Kurulumu (Eğer yoksa)
if ! command -v node > /dev/null; then
  echo "Node.js (20.x) Kuruluyor..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "[1.5/4] Webmail (SnappyMail) Kuruluyor..."
mkdir -p /var/www/webmail
cd /var/www/webmail
LATEST_SNAPPY=$(curl -s https://api.github.com/repos/the-djmaze/snappymail/releases/latest | grep "browser_download_url.*zip" | cut -d '"' -f 4)
wget -qO snappymail.zip "$LATEST_SNAPPY"
unzip -q -o snappymail.zip -d .
rm snappymail.zip
chown -R www-data:www-data /var/www/webmail
chmod -R 755 /var/www/webmail

echo "[2/4] Proje GitHub'dan Klonlanıyor: $REPO_URL"
APPSERVER_DIR="/opt/appserver"
if [ -d "$APPSERVER_DIR" ]; then
  echo "Uyarı: $APPSERVER_DIR dizini zaten var. Önceki sürüm yedekleniyor..."
  mv $APPSERVER_DIR "${APPSERVER_DIR}_backup_$(date +%s)"
fi

git clone "$REPO_URL" $APPSERVER_DIR
cd $APPSERVER_DIR

echo "[3/4] Backend ve Frontend Bağımlılıkları Derleniyor..."
# Backend
cd appserver-backend
npm install
cd ..

# Frontend
cd appserver-frontend
npm install
npm run build
cd ..

echo "[4/4] NPM PM2 Arka Plan Servisi Ayarlanıyor..."
npm install -g pm2
cd appserver-backend
pm2 delete appserver-panel 2>/dev/null || true
pm2 start server.js --name "appserver-panel"
pm2 save
env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root

# Temizlik ve Nginx Yeniden Başlatma
rm -f /var/www/html/index.nginx-debian.html 2>/dev/null || true
systemctl restart nginx || true

echo "=========================================="
echo "KURULUM BAŞARIYLA TAMAMLANDI! 🚀"
echo "Tüm sistemler aktif edildi."
echo "------------------------------------------"
echo "Yönetici (WHM) Paneli: http://SUNUCU_IP_ADRESI:3001"
echo "Kullanıcı (cPanel) Paneli: http://SUNUCU_IP_ADRESI:3002"
echo "=========================================="
