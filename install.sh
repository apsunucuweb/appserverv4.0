#!/bin/bash
# AppServer Linux Kurulum Betiği (Ubuntu/Debian)

if [ "$EUID" -ne 0 ]; then
  echo "Lütfen bu betiği root olarak çalıştırın (sudo ./install.sh)"
  exit 1
fi

echo "=========================================="
echo "          AppServer Linux Kurulumu        "
echo "=========================================="

echo "[1/4] Sistem Gereksinimleri Kontrol Ediliyor (Node.js, Nginx, Certbot, VSFTPD)..."
if ! command -v node > /dev/null; then
  echo "Node.js bulunamadı. Kuruluyor (Node.js 20.x)..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# Nginx, Certbot ve VSFTPD kurulumu
apt-get update
apt-get install -y nginx certbot python3-certbot-nginx vsftpd

# VSFTPD Yapılandırması (Kullanıcıları kendi dizinlerine hapsetmek için)
echo "allow_writeable_chroot=YES" >> /etc/vsftpd.conf
sed -i 's/#chroot_local_user=YES/chroot_local_user=YES/g' /etc/vsftpd.conf
# /bin/false kullanarak FTP girenlerin SSH girmesini engellemek için pam ayarları
echo "/bin/false" >> /etc/shells
systemctl restart vsftpd
systemctl enable vsftpd

echo "[2/4] AppServer Backend Bağımlılıkları Kuruluyor..."
cd appserver-backend
npm install
cd ..

echo "[3/4] AppServer Frontend Arayüzü Derleniyor..."
cd appserver-frontend
npm install
npm run build
cd ..

echo "[4/4] Systemd Servisi (Arka Plan Hizmeti) Oluşturuluyor..."
APPSERVER_DIR=$(pwd)

cat > /etc/systemd/system/appserver.service <<EOF
[Unit]
Description=AppServer Web Hosting Control Panel
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${APPSERVER_DIR}/appserver-backend
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Servisleri yeniden yükle ve başlat
systemctl daemon-reload
systemctl enable appserver
systemctl restart appserver

echo "=========================================="
echo "Kurulum başarıyla tamamlandı!"
echo "Panelinize sunucunuzun IP adresi üzerinden ulaşabilirsiniz:"
echo "http://SUNUCU_IP_ADRESI:3001"
echo "=========================================="
