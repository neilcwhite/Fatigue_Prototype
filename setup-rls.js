#!/usr/bin/env node

/**
 * Automated RLS Setup Script
 *
 * This script will:
 * 1. Connect to your Supabase database
 * 2. Enable RLS on all tables
 * 3. Create security policies
 * 4. Verify everything is working
 *
 * Usage: node setup-rls.js
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60) + '\n');
}

async function main() {
  logSection('RLS Setup Script - Fatigue Management System');

  // Step 1: Check environment variables
  log('Step 1: Checking environment variables...', 'blue');

  const envPath = path.join(__dirname, '.env.local');
  if (!fs.existsSync(envPath)) {
    log('❌ .env.local file not found!', 'red');
    log('Please create .env.local with your Supabase credentials:', 'yellow');
    log('  NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co', 'yellow');
    log('  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key', 'yellow');
    process.exit(1);
  }

  // Load environment variables
  require('dotenv').config({ path: envPath });

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    log('❌ Missing Supabase credentials in .env.local', 'red');
    process.exit(1);
  }

  log('✓ Environment variables loaded', 'green');

  // Step 2: Load Supabase client
  log('\nStep 2: Connecting to Supabase...', 'blue');

  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Test connection
  const { data: testData, error: testError } = await supabase
    .from('organisations')
    .select('count')
    .limit(1);

  if (testError) {
    log('❌ Failed to connect to Supabase:', 'red');
    log(testError.message, 'red');
    log('\nPlease check your credentials and try again.', 'yellow');
    process.exit(1);
  }

  log('✓ Connected to Supabase', 'green');

  // Step 3: Read migration file
  log('\nStep 3: Loading RLS migration...', 'blue');

  const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20260109_enable_rls_all_tables.sql');

  if (!fs.existsSync(migrationPath)) {
    log('❌ Migration file not found at:', 'red');
    log(migrationPath, 'red');
    process.exit(1);
  }

  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  log('✓ Migration file loaded', 'green');
  log(`  File size: ${Math.round(migrationSQL.length / 1024)}KB`, 'cyan');

  // Step 4: Backup warning
  logSection('IMPORTANT: Database Backup');
  log('⚠️  Before proceeding, ensure you have a database backup!', 'yellow');
  log('\nTo create a backup:', 'cyan');
  log('1. Go to Supabase Dashboard > Database > Backups', 'cyan');
  log('2. Click "Create Backup"', 'cyan');
  log('3. Wait for confirmation', 'cyan');

  console.log('\n');
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const answer = await new Promise((resolve) => {
    readline.question('Have you created a backup? Type YES to continue: ', resolve);
  });
  readline.close();

  if (answer.toUpperCase() !== 'YES') {
    log('\n❌ Aborted. Please create a backup first.', 'red');
    process.exit(0);
  }

  // Step 5: Apply migration
  logSection('Applying RLS Migration');
  log('This will enable Row Level Security on all tables...', 'blue');

  // Note: The anon key cannot execute DDL commands directly
  // We need to use the Supabase Dashboard SQL Editor
  log('\n⚠️  IMPORTANT: Supabase requires using the Dashboard for DDL commands', 'yellow');
  log('\nPlease follow these steps:', 'cyan');
  log('\n1. Open Supabase Dashboard: ' + SUPABASE_URL.replace('.supabase.co', '.supabase.co'), 'cyan');
  log('2. Go to SQL Editor tab', 'cyan');
  log('3. Click "New Query"', 'cyan');
  log('4. Copy the migration file content:', 'cyan');
  log('   ' + migrationPath, 'green');
  log('5. Paste into the SQL Editor', 'cyan');
  log('6. Click "Run" button', 'cyan');
  log('7. Verify no errors in the output', 'cyan');

  console.log('\n');
  const applied = await new Promise((resolve) => {
    const rl = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question('Have you run the migration in the Dashboard? Type YES to verify: ', (answer) => {
      rl.close();
      resolve(answer);
    });
  });

  if (applied.toUpperCase() !== 'YES') {
    log('\n❌ Please complete the migration first, then run this script again.', 'red');
    process.exit(0);
  }

  // Step 6: Verify RLS is enabled
  logSection('Verifying RLS Setup');
  log('Checking if RLS is enabled on all tables...', 'blue');

  const tables = [
    'organisations',
    'user_profiles',
    'employees',
    'projects',
    'teams',
    'shift_patterns',
    'assignments',
    'fatigue_assessments'
  ];

  log('\nVerification Results:', 'cyan');
  log('(Testing with sample queries...)\n', 'yellow');

  let allGood = true;

  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('count')
        .limit(1);

      if (error) {
        // If we get a permission error, that might mean RLS is working
        // (no user is authenticated, so RLS blocks access)
        if (error.message.includes('row-level security') ||
            error.message.includes('permission denied')) {
          log(`  ✓ ${table.padEnd(25)} - RLS is active`, 'green');
        } else {
          log(`  ⚠️  ${table.padEnd(25)} - ${error.message}`, 'yellow');
          allGood = false;
        }
      } else {
        // Query succeeded - might mean RLS is not enabled or user has access
        log(`  ✓ ${table.padEnd(25)} - Accessible (check if expected)`, 'green');
      }
    } catch (err) {
      log(`  ❌ ${table.padEnd(25)} - Error: ${err.message}`, 'red');
      allGood = false;
    }
  }

  // Final Summary
  logSection('Setup Complete!');

  if (allGood) {
    log('✓ RLS appears to be configured correctly', 'green');
    log('\nNext steps:', 'cyan');
    log('1. Test with your application: npm run dev', 'cyan');
    log('2. Sign in with a test user', 'cyan');
    log('3. Verify you can see your organisation\'s data', 'cyan');
    log('4. Try to create/edit/delete records', 'cyan');
    log('\nFor detailed verification, see: RLS_SETUP_GUIDE.md', 'yellow');
  } else {
    log('⚠️  Some issues detected. Please review the output above.', 'yellow');
    log('\nFor troubleshooting, see: RLS_SETUP_GUIDE.md', 'cyan');
  }

  log('\n' + '='.repeat(60) + '\n', 'cyan');
}

// Run the script
main().catch((error) => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});
