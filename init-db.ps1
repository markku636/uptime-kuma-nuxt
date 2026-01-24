# Uptime Kuma Nuxt - Database Initialization Script
# This script will:
# 1. Start PostgreSQL container
# 2. Run Prisma migrations
# 3. Create initial admin user

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Uptime Kuma Nuxt - Database Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$DB_HOST = "localhost"
$DB_PORT = "32402"
$DB_NAME = "uptime_kuma"
$DB_USER = "postgres"
$DB_PASSWORD = "postgres"
$ADMIN_USERNAME = "admin"
$ADMIN_PASSWORD = "admin123"

# Update .env file with correct credentials
Write-Host "[1/5] Updating .env file..." -ForegroundColor Yellow
$envContent = @"
# Database
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public"

# JWT Secret
JWT_SECRET="your-secret-key-change-this-in-production"

# App URL
NUXT_PUBLIC_APP_URL="http://localhost:32401"

# Node Environment
NODE_ENV="development"

NUXT_SESSION_PASSWORD=2101fb00c0c04243a397cd43049a904e
"@
$envContent | Out-File -FilePath ".env" -Encoding utf8 -Force
Write-Host "  .env file updated!" -ForegroundColor Green

# Check if Docker is running
Write-Host "[2/5] Starting PostgreSQL container..." -ForegroundColor Yellow
try {
    docker ps | Out-Null
} catch {
    Write-Host "  ERROR: Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Start only the database container
docker-compose up -d db
Start-Sleep -Seconds 5

# Wait for PostgreSQL to be ready
Write-Host "[3/5] Waiting for PostgreSQL to be ready..." -ForegroundColor Yellow
$maxRetries = 30
$retryCount = 0
do {
    $retryCount++
    try {
        $result = docker-compose exec -T db pg_isready -U postgres 2>&1
        if ($result -like "*accepting connections*") {
            Write-Host "  PostgreSQL is ready!" -ForegroundColor Green
            break
        }
    } catch {}
    Write-Host "  Waiting... ($retryCount/$maxRetries)"
    Start-Sleep -Seconds 2
} while ($retryCount -lt $maxRetries)

if ($retryCount -ge $maxRetries) {
    Write-Host "  ERROR: PostgreSQL did not start in time." -ForegroundColor Red
    exit 1
}

# Run Prisma migrations
Write-Host "[4/5] Running Prisma migrations..." -ForegroundColor Yellow
npx prisma generate
npx prisma db push --accept-data-loss
Write-Host "  Database schema created!" -ForegroundColor Green

# Create admin user
Write-Host "[5/5] Creating admin user..." -ForegroundColor Yellow

# Generate bcrypt hash for password using Node.js
$createUserScript = @"
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function createAdminUser() {
  const prisma = new PrismaClient();
  
  try {
    // Check if admin user already exists
    const existingUser = await prisma.user.findUnique({
      where: { username: '$ADMIN_USERNAME' }
    });
    
    if (existingUser) {
      console.log('Admin user already exists, updating password...');
      const hashedPassword = await bcrypt.hash('$ADMIN_PASSWORD', 10);
      await prisma.user.update({
        where: { username: '$ADMIN_USERNAME' },
        data: { password: hashedPassword }
      });
      console.log('Password updated!');
    } else {
      console.log('Creating new admin user...');
      const hashedPassword = await bcrypt.hash('$ADMIN_PASSWORD', 10);
      await prisma.user.create({
        data: {
          username: '$ADMIN_USERNAME',
          password: hashedPassword,
          active: true
        }
      });
      console.log('Admin user created!');
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.\$disconnect();
  }
}

createAdminUser();
"@

$createUserScript | Out-File -FilePath "temp-create-user.cjs" -Encoding utf8 -Force
node temp-create-user.cjs
Remove-Item "temp-create-user.cjs" -Force

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Database: PostgreSQL running on port $DB_PORT" -ForegroundColor Cyan
Write-Host ""
Write-Host "Admin Credentials:" -ForegroundColor Yellow
Write-Host "  Username: $ADMIN_USERNAME" -ForegroundColor White
Write-Host "  Password: $ADMIN_PASSWORD" -ForegroundColor White
Write-Host ""
Write-Host "To start the app, run:" -ForegroundColor Cyan
Write-Host "  npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Then visit: http://localhost:32401" -ForegroundColor Cyan
