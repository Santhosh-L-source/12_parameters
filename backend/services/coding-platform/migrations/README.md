# Migration to Supabase

This guide will help you migrate from SQLite to Supabase (PostgreSQL).

## Prerequisites

1. **Create a Supabase account** at https://supabase.com
2. **Create a new Supabase project**
3. **Get your database credentials** from Supabase dashboard

## Step 1: Get Supabase Credentials

1. Go to your Supabase project dashboard
2. Click on **"Project Settings"** (gear icon)
3. Click on **"Database"** in the sidebar
4. You'll find:
   - **Host**: `db.xxxxxxxxxxxxx.supabase.co`
   - **Database name**: `postgres`
   - **Port**: `5432`
   - **User**: `postgres`
   - **Password**: Your project password

**OR** use the **Connection String**:
```
postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxxx.supabase.co:5432/postgres
```

## Step 2: Update .env File

Open `.env` file and update these values:

### Option A: Using individual parameters
```env
DB_DIALECT=postgres
DB_HOST=db.xxxxxxxxxxxxx.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your-supabase-password
JWT_SECRET=your-secure-jwt-secret-min-32-chars
```

### Option B: Using connection string (recommended)
```env
DATABASE_URL=postgresql://postgres:your-password@db.xxxxxxxxxxxxx.supabase.co:5432/postgres
JWT_SECRET=your-secure-jwt-secret-min-32-chars
```

## Step 3: Create Database Schema in Supabase

1. Open **Supabase Dashboard** → **SQL Editor**
2. Open the file `migrations/001_initial_schema.sql`
3. **Copy all the SQL code**
4. **Paste it in the Supabase SQL Editor**
5. Click **"Run"** to execute

This will create all tables, indexes, and triggers.

## Step 4: Migrate Existing Data

If you have existing data in SQLite that you want to migrate:

```bash
node migrations/migrate-to-supabase.js
```

This script will:
- ✅ Connect to both SQLite and Supabase
- ✅ Migrate all students
- ✅ Migrate all coding evidence
- ✅ Migrate all verification attempts
- ✅ Update PostgreSQL sequences

## Step 5: Restart the Application

```bash
# Stop the current server (Ctrl+C)

# Restart with Supabase
npm start
```

## Step 6: Verify Everything Works

1. **Login** to your application
2. **Check if your data is visible**
3. **Try adding new evidence**
4. **Try verification**
5. **Check problem counts sync**

## Backup

**IMPORTANT**: Keep your SQLite database (`hope_evidence.sqlite`) as a backup until you've verified everything works in Supabase!

## Rollback to SQLite (if needed)

If you need to rollback to SQLite:

1. Update `.env`:
   ```env
   DB_DIALECT=sqlite
   DB_STORAGE=./hope_evidence.sqlite
   ```

2. Restart the application

## Troubleshooting

### Connection Error: "self signed certificate"

Add this to your .env if using individual parameters:
```env
NODE_TLS_REJECT_UNAUTHORIZED=0
```

The database.js already handles SSL for Supabase.

### "relation does not exist" error

Make sure you ran the schema SQL in Step 3.

### Migration script fails

Check:
- Supabase credentials are correct
- Schema was created successfully
- No firewall blocking connection

### Can't connect from local machine

Supabase allows connections from anywhere by default. If you have issues:
1. Go to Supabase Dashboard → Settings → Database
2. Check "Connection Pooling" settings
3. Use port **6543** (pooler) instead of **5432** (direct)

## Benefits of Supabase

✅ **Cloud-hosted** - No local database maintenance
✅ **PostgreSQL** - More powerful than SQLite
✅ **Automatic backups** - Built-in by Supabase
✅ **Real-time subscriptions** - Can add real-time features later
✅ **Free tier** - Up to 500MB database
✅ **Built-in auth** - Can integrate Supabase Auth later
✅ **Dashboard** - Easy to view/edit data

## Support

If you encounter issues:
1. Check the logs: `tail -f server.log`
2. Verify credentials in .env
3. Test connection with: `psql "your-connection-string"`
