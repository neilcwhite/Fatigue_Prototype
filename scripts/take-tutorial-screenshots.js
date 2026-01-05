// Tutorial Screenshot Script
// Launches a new browser - you'll need to log in manually
//
// Usage: node scripts/take-tutorial-screenshots.js

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOTS_DIR = path.join(__dirname, '../public/tutorials');
const APP_URL = 'http://localhost:3003';

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function takeScreenshots() {
  console.log('Launching browser...');
  console.log('');

  // Launch a fresh browser
  const browser = await chromium.launch({
    headless: false,
    slowMo: 300
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();

  // Navigate to app
  console.log(`Opening ${APP_URL}...`);
  await page.goto(APP_URL);

  console.log('');
  console.log('==============================================');
  console.log('  Please LOG IN to the application now');
  console.log('  The script will wait 60 seconds...');
  console.log('==============================================');
  console.log('');

  // Wait for user to log in (60 seconds)
  await page.waitForTimeout(60000);

  console.log('Taking screenshots...');
  console.log('');

  try {
    // 1. Dashboard
    console.log('1. Dashboard...');
    await page.click('text=Dashboard');
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '01-dashboard.png'),
      fullPage: false
    });
    console.log('   Saved: 01-dashboard.png');

    // 2. Create Project modal
    console.log('2. Create Project modal...');
    const createProjectCard = await page.$('text=Create New Project');
    if (createProjectCard) {
      await createProjectCard.click();
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '02-create-project-modal.png'),
        fullPage: false
      });
      console.log('   Saved: 02-create-project-modal.png');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else {
      console.log('   Create Project card not found, skipping...');
    }

    // 3. Teams page
    console.log('3. Teams page...');
    await page.click('text=Teams');
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '03-teams-page.png'),
      fullPage: false
    });
    console.log('   Saved: 03-teams-page.png');

    // 4. Add Employee modal
    console.log('4. Add Employee modal...');
    const addEmployeeBtn = await page.$('button:has-text("Add Employee")');
    if (addEmployeeBtn) {
      await addEmployeeBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '04-add-employee-modal.png'),
        fullPage: false
      });
      console.log('   Saved: 04-add-employee-modal.png');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else {
      console.log('   Add Employee button not found, skipping...');
    }

    // 5. Create Team modal
    console.log('5. Create Team modal...');
    const createTeamBtn = await page.$('button:has-text("Create Team")');
    if (createTeamBtn) {
      await createTeamBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '05-create-team-modal.png'),
        fullPage: false
      });
      console.log('   Saved: 05-create-team-modal.png');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else {
      const createTeamCard = await page.$('text=Create New Team');
      if (createTeamCard) {
        await createTeamCard.click();
        await page.waitForTimeout(1000);
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, '05-create-team-modal.png'),
          fullPage: false
        });
        console.log('   Saved: 05-create-team-modal.png');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      } else {
        console.log('   Create Team button not found, skipping...');
      }
    }

    // 6. Shift Builder - close any open modal first
    console.log('6. Shift Builder...');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await page.click('text=Shift Builder');
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '06-shift-builder.png'),
      fullPage: false
    });
    console.log('   Saved: 06-shift-builder.png');

    // Close any modal that might be open
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // 7. Planning view (need to select a project first)
    console.log('7. Planning view (selecting project first)...');
    await page.click('text=Dashboard');
    await page.waitForTimeout(2000);

    // Close any modal that might be open
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Look for Open Planning button on a project card
    const openPlanningBtn = await page.$('button:has-text("Open Planning")');

    if (openPlanningBtn) {
      await openPlanningBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '07-planning-view.png'),
        fullPage: false
      });
      console.log('   Saved: 07-planning-view.png');
    } else {
      console.log('   No project with Open Planning found - need a project with shift pattern');
    }

    console.log('');
    console.log('==============================================');
    console.log('  All screenshots saved to: public/tutorials/');
    console.log('==============================================');
    console.log('');

  } catch (error) {
    console.error('Error taking screenshots:', error.message);
  }

  console.log('Browser will close in 10 seconds...');
  await page.waitForTimeout(10000);
  await browser.close();
}

takeScreenshots().catch(console.error);
