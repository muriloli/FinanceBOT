@echo off
echo Iniciando FinanceFlow Bot...
echo.
echo Verificando arquivo .env...
if exist .env (
    echo ✓ Arquivo .env encontrado
) else (
    echo ✗ Arquivo .env NAO encontrado! Crie o arquivo .env primeiro.
    pause
    exit /b 1
)
echo.
echo Carregando variaveis de ambiente...
for /f "delims== tokens=1,2" %%G in (.env) do set %%G=%%H
echo ✓ Variaveis carregadas
echo.
echo Iniciando servidor...
npx tsx server/index.ts
pause