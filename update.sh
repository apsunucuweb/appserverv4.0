#!/bin/bash
# AppServer Güncelleme Betiği

if [ "$EUID" -ne 0 ]; then
  echo "Lütfen bu betiği root olarak çalıştırın (sudo ./update.sh)"
  exit 1
fi

echo "=========================================="
echo "          AppServer Güncelleniyor         "
echo "=========================================="

echo "[1/4] GitHub'dan son değişiklikler çekiliyor..."
cd /opt/apsunucuv4.0
git pull origin main

echo "[2/4] Backend bağımlılıkları güncelleniyor..."
cd appserver-backend
npm install
cd ..

echo "[3/4] Frontend güncelleniyor ve derleniyor..."
cd appserver-frontend
npm install
npm run build
cd ..

echo "[4/4] AppServer servisi yeniden başlatılıyor..."
systemctl restart appserver

echo "=========================================="
echo "Güncelleme başarıyla tamamlandı!"
echo "=========================================="
