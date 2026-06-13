@echo off
chcp 65001 >nul
title BoriPedidos
cd /d "%~dp0"

echo ============================================
echo            LIGANDO O BORIPEDIDOS
echo ============================================
echo.

REM Instala as pecas na primeira vez (pula o download do Chrome).
if not exist "node_modules" (
  echo Primeira vez: instalando as pecas, aguarde alguns minutos...
  echo.
  call npm install
  echo.
)

echo Ligando... quando aparecer "rodando em http://localhost:3000",
echo abra o navegador e va em:  localhost:3000
echo.
echo (Para desligar, feche esta janela.)
echo.

call npm start

echo.
echo O BoriPedidos foi encerrado. Pode fechar esta janela.
pause
