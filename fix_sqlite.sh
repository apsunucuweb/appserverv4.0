#!/bin/bash
# AppServer SQLite3 Onarma Betiği

if [ "$EUID" -ne 0 ]; then
  echo "Lütfen bu betiği root olarak çalıştırın (sudo ./fix_sqlite.sh)"
  exit 1
fi

echo "=========================================="
echo "          SQLite3 Yeniden Derleniyor...   "
echo "=========================================="

cd /opt/appserverv4.0/appserver-backend

# Önceki hatalı SQLite build'ini temizleyip baştan derleyelim
npm install sqlite3 --build-from-source

echo "=========================================="
echo "          Uygulama Yeniden Başlatılıyor  "
echo "=========================================="

systemctl restart appserver
systemctl status appserver
