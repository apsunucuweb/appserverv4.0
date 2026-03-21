@echo off
echo ==========================================
echo        AppServer Kurulum ve Baslatma
echo ==========================================

echo [1/3] Backend bagimliliklari kontrol ediliyor...
cd appserver-backend
call npm install --silent
cd ..

echo [2/3] Frontend paneli derleniyor...
cd appserver-frontend
call npm install --silent
call npm run build
cd ..

echo [3/3] AppServer baslatiliyor...
echo.
echo Panel tarayicida erisilebilir olacaktir: http://localhost:3001
echo Geri planda calismaya devam etmesi icin bu pencereyi acik tutun.
echo.
cd appserver-backend
node server.js
pause
