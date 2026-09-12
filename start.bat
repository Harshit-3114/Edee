@echo off
setlocal EnableDelayedExpansion

rem ============================================================================
rem  Edee Apply - one command to get the whole platform running locally.
rem
rem  What this does, in order:
rem    1. Verifies Docker, Python and Node are installed.
rem    2. Starts Docker Desktop if needed, clears a stale DB container if one
rem       exists, then starts Postgres published on host port 5433.
rem    3. Creates backend\.env if missing and installs backend\venv dependencies.
rem    4. Creates frontend\.env.local if missing and installs node_modules.
rem    5. Waits for Postgres health, runs Alembic migrations, seeds colleges.
rem    6. Seeds demo role accounts only when a Firebase service account exists.
rem    7. Launches the backend (port 8000) and frontend (port 3000), waits for
rem       both to respond, then prints the local URLs.
rem
rem  No API keys are required for local UI testing. Placeholder/example env
rem  values are enough to boot the site; sign-in and payments stay disabled
rem  until real Firebase/Razorpay credentials are supplied. This script does
rem  not create external API resources or accounts.
rem
rem  The database uses host port 5433 so it does not collide with a locally
rem  installed PostgreSQL on 5432. The backend connects through DATABASE_URL.
rem
rem  This script does not run the test suites. After both servers are up, use:
rem    backend:  backend\venv\Scripts\python.exe -m pytest -q
rem    frontend: cd frontend && npm run test && npm run typecheck && npm run lint
rem
rem  Safe to run repeatedly: every step is skipped when already satisfied.
rem ============================================================================

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

set "BACKEND=%ROOT%\backend"
set "FRONTEND=%ROOT%\frontend"

echo.
echo ============================================================
echo   Edee Apply - setup and launch
echo ============================================================
echo.

rem ---------------------------------------------------------------------------
rem 1. Toolchain checks
rem ---------------------------------------------------------------------------
set "STEP_FAILED="

where docker >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker was not found on PATH. Please install Docker Desktop.
    set "STEP_FAILED=1"
)
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js was not found on PATH. Please install Node LTS.
    set "STEP_FAILED=1"
)

rem Python: accept "python" or the "py" launcher.
set "PY="
where python >nul 2>&1 && set "PY=python"
if not defined PY (
    where py >nul 2>&1 && set "PY=py -3"
)
if not defined PY (
    echo [ERROR] Python was not found on PATH and the "py" launcher is missing. Install Python 3.11+.
    set "STEP_FAILED=1"
)

if defined STEP_FAILED (
    echo.
    echo Fix the missing toolchain above and run this script again.
    pause
    exit /b 1
)

echo [ok] Docker, Node.js and Python are all available.

rem ---------------------------------------------------------------------------
rem 2. Docker daemon + database
rem ---------------------------------------------------------------------------
set "DB_STARTED=0"
docker info >nul 2>&1
if errorlevel 1 (
    echo.
    echo Docker is installed but the daemon is not running. Starting Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo Waiting up to 90s for Docker to come up...
    set /a "WAITS=0"
    :wait_docker
    timeout /t 2 /nobreak >nul
    docker info >nul 2>&1
    if errorlevel 1 (
        set /a "WAITS+=1"
        if !WAITS! lss 45 goto wait_docker
        echo [WARN] Docker did not start in time. The backend will not be able to reach the database.
        goto docker_missing
    )
)
:after_docker_wait

echo [ok] Docker daemon is running.

rem A previous run may have left a stopped container of the same name, which
rem makes `docker compose up` fail with a name conflict. Remove it only when it
rem is not already running; the data volume keeps whatever was stored.
docker inspect -f "{{.State.Running}}" college-platform-db 2>nul | findstr /c:"true" >nul
if errorlevel 1 (
    docker rm -f college-platform-db >nul 2>&1
) else (
    echo [ok] Database container is already running - reusing it.
)

echo [ok] Starting the database container...
docker compose -f "%ROOT%\docker-compose.yml" up -d db
if errorlevel 1 (
    echo [ERROR] Failed to start the database container.
    pause
    exit /b 1
)
set "DB_STARTED=1"
echo [ok] Database is starting.

rem Wait for Postgres to report "healthy" before running migrations, so the
rem script never races the container's startup.
set /a "DB_WAITS=0"
:wait_db
if "!DB_STARTED!" equ "0" goto db_timeout
docker inspect --format "{{.State.Health.Status}}" college-platform-db 2>nul | findstr /c:"healthy" >nul
if errorlevel 1 (
    set /a "DB_WAITS+=1"
    if !DB_WAITS! geq 60 goto db_timeout
    timeout /t 2 /nobreak >nul
    goto wait_db
)
echo [ok] Database is ready.

:db_timeout
if "!DB_STARTED!" equ "1" if "!DB_WAITS!" geq "60" (
    echo [WARN] Database did not become healthy within 120s. Migrations may fail.
)

:docker_missing
if "!DB_STARTED!" equ "0" (
    echo.
    echo [ERROR] Local testing needs the Docker Postgres container, but it is not running.
    echo         Start Docker Desktop and run start.bat again.
    pause
    exit /b 1
)

rem ---------------------------------------------------------------------------
rem 3. Backend environment + dependencies
rem ---------------------------------------------------------------------------
echo.
echo [3/7] Setting up the backend...

if not exist "%BACKEND%\.env" (
    copy "%BACKEND%\.env.example" "%BACKEND%\.env" >nul
    echo [ok] Created backend\.env from the example. Local testing needs no API keys; sign-in and payments stay disabled until real Firebase/Razorpay keys are added.
) else (
    echo [ok] backend\.env already exists - leaving it untouched, except for one safe local-database fix below.
)

rem An older local .env may still point at host port 5432, while this setup
rem publishes Docker Postgres on host port 5433. Update only that exact local
rem DATABASE_URL substring so local testing keeps working.
findstr /c:"localhost:5432/college_platform" "%BACKEND%\.env" >nul
if not errorlevel 1 (
    echo [ok] Pointing the existing backend DATABASE_URL from local 5432 to Docker 5433...
    powershell -NoProfile -Command "(Get-Content -LiteralPath '%BACKEND%\.env') -replace 'localhost:5432/college_platform','localhost:5433/college_platform' | Set-Content -LiteralPath '%BACKEND%\.env'"
)

if not exist "%BACKEND%\venv\Scripts\python.exe" (
    echo [ok] Creating Python virtual environment...
    pushd "%BACKEND%"
    %PY% -m venv venv
    if errorlevel 1 (
        popd
        echo [ERROR] Could not create the virtual environment.
        pause
        exit /b 1
    )
    popd
) else (
    echo [ok] Virtual environment already present.
)

echo [ok] Installing backend dependencies (first run can take a minute)...
"%BACKEND%\venv\Scripts\python.exe" -m pip install --disable-pip-version-check -q -r "%BACKEND%\requirements.txt"
if errorlevel 1 (
    echo [ERROR] Failed to install backend dependencies.
    pause
    exit /b 1
)
echo [ok] Backend dependencies installed.

rem ---------------------------------------------------------------------------
rem 4. Frontend dependencies
rem ---------------------------------------------------------------------------
echo.
echo [4/7] Setting up the frontend...

if not exist "%FRONTEND%\.env.local" (
    copy "%FRONTEND%\.env.local.example" "%FRONTEND%\.env.local" >nul
    echo [ok] Created frontend\.env.local from the example. Local testing needs no API keys; sign-in stays disabled until the NEXT_PUBLIC_FIREBASE_* values are added.
) else (
    echo [ok] frontend\.env.local already exists - leaving it untouched.
)

if not exist "%FRONTEND%\node_modules" (
    echo [ok] Installing frontend dependencies. The first run can take a few minutes...
    pushd "%FRONTEND%"
    call npm ci
    if errorlevel 1 (
        popd
        echo [ERROR] npm install failed. Check your network and try again.
        pause
        exit /b 1
    )
    popd
) else (
    echo [ok] node_modules already present - skipping install.
)
echo [ok] Frontend dependencies installed.

rem ---------------------------------------------------------------------------
rem 5. Database migrations + seed data
rem ---------------------------------------------------------------------------
echo.
echo [5/7] Applying database migrations and seed data...

echo [..] Running Alembic migrations...
pushd "%BACKEND%"
"%BACKEND%\venv\Scripts\python.exe" -m alembic upgrade head
if errorlevel 1 (
    popd
    echo [ERROR] Migrations failed to run.
    pause
    exit /b 1
)

echo [..] Seeding sample colleges...
"%BACKEND%\venv\Scripts\python.exe" -m seeds.colleges
if errorlevel 1 (
    echo [WARN] College seed failed. You can re-run it later with:
    echo        "%BACKEND%\venv\Scripts\python.exe" -m seeds.colleges
)
popd

rem ---------------------------------------------------------------------------
rem 6. Seed demo accounts (needs a real Firebase service account)
rem ---------------------------------------------------------------------------
echo.
echo [6/7] Demo accounts...
if exist "%BACKEND%\firebase-service-account.json" (
    echo [ok] Firebase service account found - creating one demo account per role...
    pushd "%BACKEND%"
    "%BACKEND%\venv\Scripts\python.exe" -m seeds.users
    popd
) else (
    echo [skip] No firebase-service-account.json in backend\. Sign-in and the demo
    echo       accounts need a real Firebase project. See backend\.env.example.
)

rem ---------------------------------------------------------------------------
rem 7. Launch and verify the servers
rem ---------------------------------------------------------------------------
echo.
echo [7/7] Launching the servers in separate windows...
echo.

set "BACKEND_OK=0"
set "FRONTEND_OK=0"

echo [ok] Starting backend at http://localhost:8000 ...
rem /D sets the working directory, and the command is a single relative path,
rem so no nested quoting is needed (paths with spaces stay safe).
start "Edee Backend (8000)" /D "%BACKEND%" cmd.exe /k "venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"

echo [ok] Starting frontend at http://localhost:3000 ...
start "Edee Frontend (3000)" /D "%FRONTEND%" cmd.exe /k "npm run dev"

echo.
echo [..] Waiting for the backend to respond...
set /a "BACKEND_WAITS=0"
:wait_backend
powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 'http://localhost:8000/health').StatusCode } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    set /a "BACKEND_WAITS+=1"
    if !BACKEND_WAITS! geq 45 goto backend_timeout
    timeout /t 2 /nobreak >nul
    goto wait_backend
)
set "BACKEND_OK=1"
echo [ok] Backend is responding at http://localhost:8000/health.
goto backend_check_done
:backend_timeout
echo [WARN] Backend did not respond within 90 seconds. Check the backend server window for errors.
:backend_check_done

echo [..] Waiting for the frontend to respond...
set /a "FRONTEND_WAITS=0"
:wait_frontend
powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 'http://localhost:3000/').StatusCode } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    set /a "FRONTEND_WAITS+=1"
    if !FRONTEND_WAITS! geq 60 goto frontend_timeout
    timeout /t 2 /nobreak >nul
    goto wait_frontend
)
set "FRONTEND_OK=1"
echo [ok] Frontend is responding at http://localhost:3000/.
goto frontend_check_done
:frontend_timeout
echo [WARN] Frontend did not respond within 120 seconds. Check the frontend server window for errors.
:frontend_check_done

echo.
echo ============================================================
if "!BACKEND_OK!" equ "1" if "!FRONTEND_OK!" equ "1" (
    echo   Done. Both local servers are responding:
    echo     Backend   -> http://localhost:8000/docs   - docs are hidden in production
    echo     Frontend  -> http://localhost:3000
    echo     Database  -> 127.0.0.1:5433 - Docker Postgres; local installs often use 5432
) else (
    echo   Finished with warnings. Server windows are still open:
    echo     Backend responding:  !BACKEND_OK!
    echo     Frontend responding: !FRONTEND_OK!
    echo     Check the matching server window, then rerun start.bat.
)
echo.
echo   Useful URLs:
echo     Student      http://localhost:3000/student/dashboard
echo     College      http://localhost:3000/college/dashboard
echo     Coaching     http://localhost:3000/coaching/dashboard
echo     Admin        http://localhost:3000/admin/dashboard
echo ============================================================
echo.
echo NOTE: Local testing needs no API keys. Sign-in, role assignment, and
echo       payments stay disabled until real Firebase and Razorpay credentials
echo       are added to backend\.env and frontend\.env.local.
echo.

pause
endlocal