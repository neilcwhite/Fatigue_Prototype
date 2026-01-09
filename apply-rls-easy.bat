@echo off
REM ============================================
REM Easy RLS Setup for Windows
REM This script guides you through enabling RLS
REM ============================================

echo.
echo ============================================
echo    RLS Setup - Fatigue Management System
echo ============================================
echo.

REM Check if .env.local exists
if not exist ".env.local" (
    echo ERROR: .env.local file not found!
    echo.
    echo Please create .env.local with your Supabase credentials:
    echo   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
    echo   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
    echo.
    pause
    exit /b 1
)

REM Read Supabase URL from .env.local
for /f "tokens=1,2 delims==" %%a in ('findstr "NEXT_PUBLIC_SUPABASE_URL" .env.local') do (
    set SUPABASE_URL=%%b
)

if "%SUPABASE_URL%"=="" (
    echo ERROR: Could not find SUPABASE_URL in .env.local
    pause
    exit /b 1
)

echo Found your Supabase project!
echo URL: %SUPABASE_URL%
echo.
echo ============================================
echo    Step 1: Backup Your Database
echo ============================================
echo.
echo IMPORTANT: Create a backup before continuing!
echo.
echo I will open the Supabase Dashboard for you...
echo Go to: Database ^> Backups ^> Create Backup
echo.
pause

REM Extract project ID from URL
for /f "tokens=2 delims=//" %%a in ("%SUPABASE_URL%") do set DOMAIN=%%a
for /f "tokens=1 delims=." %%a in ("%DOMAIN%") do set PROJECT_ID=%%a

set DASHBOARD_URL=https://supabase.com/dashboard/project/%PROJECT_ID%/database/backups

echo Opening: %DASHBOARD_URL%
start "" "%DASHBOARD_URL%"

echo.
echo Press any key AFTER you have created a backup...
pause

echo.
echo ============================================
echo    Step 2: Apply RLS Migration
echo ============================================
echo.
echo I will now:
echo   1. Open the SQL Editor in your browser
echo   2. Copy the migration SQL to your clipboard
echo.
echo Then YOU need to:
echo   3. Paste the SQL into the editor
echo   4. Click "Run" button
echo.
pause

REM Open SQL Editor
set SQL_EDITOR_URL=https://supabase.com/dashboard/project/%PROJECT_ID%/sql/new

echo Opening SQL Editor: %SQL_EDITOR_URL%
start "" "%SQL_EDITOR_URL%"

echo.
echo Now copying the migration SQL to your clipboard...

REM Copy migration file to clipboard using PowerShell
powershell -command "Get-Content 'supabase\migrations\20260109_enable_rls_all_tables_safe.sql' -Raw | Set-Clipboard"

if %errorlevel% equ 0 (
    echo.
    echo SUCCESS! The SQL has been copied to your clipboard.
    echo.
    echo In the SQL Editor that just opened:
    echo   1. Press Ctrl+V to paste the SQL
    echo   2. Click the "Run" button
    echo   3. Check for errors in the output
    echo.
) else (
    echo.
    echo Could not copy to clipboard automatically.
    echo.
    echo Please manually copy this file:
    echo   supabase\migrations\20260109_enable_rls_all_tables_safe.sql
    echo.
)

echo Press any key AFTER you have run the migration...
pause

echo.
echo ============================================
echo    Step 3: Verification
echo ============================================
echo.
echo Let's test if RLS is working...
echo.
echo Running: npm run dev
echo.
echo After the dev server starts:
echo   1. Open http://localhost:3000
echo   2. Sign in with your test account
echo   3. Try to view/create data
echo   4. Everything should work normally
echo.
echo Press any key to start the dev server...
pause

npm run dev
