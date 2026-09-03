@echo off
rem Nafaka Hesapla - TUIK verisi icin GitHub is akisini tetikler.
rem
rem NEDEN VAR: GitHub'in kendi zamanlayicisi (workflow icindeki "schedule")
rem bu depoda 03.09.2026'da HIC tetiklenmedi - ne asil is akisi ne de 5
rem dakikada bir kosan bir deneme is akisi calisti, schedule sayaci 0 kaldi.
rem workflow_dispatch ise sorunsuz calisiyor. O yuzden tetikleme disariya,
rem Windows Gorev Zamanlayici'ya alindi.
rem
rem Veri degismemisse is akisi cikis kodu 3 verip hicbir sey yapmaz,
rem bos commit atmaz - yani her gun calismasinin zarari yok.

setlocal
set "LOG=%~dp0tetikleme-log.txt"
set "GH=C:\Program Files\GitHub CLI\gh.exe"

echo.>> "%LOG%"
echo === %DATE% %TIME% - tetikleme denemesi >> "%LOG%"

if not exist "%GH%" (
  echo HATA: gh bulunamadi: %GH% >> "%LOG%"
  exit /b 1
)

"%GH%" workflow run veri-guncelle.yml --ref main -R Ertugrul2442/nafaka-hesapla >> "%LOG%" 2>&1
set KOD=%ERRORLEVEL%
echo cikis kodu: %KOD% >> "%LOG%"

if not "%KOD%"=="0" (
  echo TETIKLEME BASARISIZ - is akisi calismadi >> "%LOG%"
) else (
  echo tetiklendi >> "%LOG%"
)

endlocal
exit /b %KOD%
