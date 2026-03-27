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
apt-get install -yq software-properties-common
add-apt-repository ppa:ondrej/php -y
apt-get update -y
# Panelin UFW, Fail2Ban, BIND9, MariaDB, Nginx, Postfix, Dovecot vb tüm özellikleri için gerekli altyapı:
apt-get install -yq curl wget git unzip vim ufw fail2ban nginx mariadb-server bind9 bind9utils bind9-doc postfix dovecot-imapd dovecot-pop3d certbot python3-certbot-nginx vsftpd php8.1-fpm php8.1-mysql php8.1-curl php8.1-mbstring php8.1-xml php8.1-zip php7.4-fpm php7.4-mysql php8.2-fpm php8.2-mysql composer

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
pm2 delete server 2>/dev/null || true
pm2 delete appserver-panel 2>/dev/null || true
pm2 delete all 2>/dev/null || true
pm2 start server.js --name "appserver-panel"
pm2 save
env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root

# Temizlik ve Nginx Yeniden Başlatma
rm -f /var/www/html/index.nginx-debian.html 2>/dev/null || true

cat << 'EOF' > /var/www/html/index.html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>AppServer - Sunucu Aktif</title>
    <style>
        body { font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; color: #f8fafc; text-align: center; padding-top: 100px; margin: 0; }
        h1 { color: #38bdf8; font-size: 3.5rem; margin-bottom: 10px; }
        p { font-size: 1.2rem; color: #94a3b8; line-height: 1.6; }
        .summary-box { margin-top: 40px; padding: 30px; display: inline-block; text-align: left; background: rgba(30, 41, 59, 0.5); border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); border: 1px solid #1e293b; max-width: 600px; }
        .summary-box h3 { margin-top: 0; color: #38bdf8; font-size: 1.5rem; border-bottom: 1px solid #334155; padding-bottom: 10px; margin-bottom: 20px;}
        .features { display: flex; gap: 15px; flex-wrap: wrap; margin-top: 25px; }
        .features span { background: #1e293b; padding: 8px 15px; border-radius: 20px; font-size: 0.9rem; font-weight: 500; color: #bae6fd; border: 1px solid #38bdf840; }
    </style>
</head>
<body>
    <h1>Tebrikler, Sunucu Hazır! 🎉</h1>
    <p>Bu modern sunucu altyapısı başarıyla kuruldu ve yayına hazır durumda.</p>
    
    <div class="summary-box">
        <h3>AppServer V6.2 Mimkârı</h3>
        <p>Görüntülediğiniz bu sayfa, profesyonel web proje yönetimi ve barındırma ihtiyaçları için tasarlanmış <strong>AppServer Hosting Paneli</strong> tarafından otomatik oluşturulmuştur.</p>
        <p>İçerisinde hiçbir hassas sunucu bilgisi, panel erişim bağlantısı veya port adresi barındırılmaz. Daha fazla bilgi için lütfen alan adı veya sunucu yöneticisi ile iletişime geçiniz.</p>
        
        <div class="features">
            <span>🚀 Nginx Sunucusu</span>
            <span>⚡ PHP-FPM Desteği</span>
            <span>📧 Gelişmiş Webmail</span>
            <span>🔒 UFW & Fail2ban</span>
        </div>
    </div>
</body>
</html>
EOF

chmod 644 /var/www/html/index.html
chown www-data:www-data /var/www/html/index.html

systemctl restart nginx || true

echo "=========================================="
echo "KURULUM BAŞARIYLA TAMAMLANDI! 🚀"
echo "Tüm sistemler aktif edildi."
echo "------------------------------------------"
echo "Yönetici (WHM) Paneli: http://SUNUCU_IP_ADRESI:3001"
echo "Kullanıcı (cPanel) Paneli: http://SUNUCU_IP_ADRESI:3002"
echo "=========================================="
