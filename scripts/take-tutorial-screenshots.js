// Tutorial Screenshot Script with Element Highlights
// Launches a new browser - you'll need to log in manually
//
// Usage: node scripts/take-tutorial-screenshots.js

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOTS_DIR = path.join(__dirname, '../public/tutorials');
const APP_URL = 'http://localhost:3004';

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Helper function to add highlight to an element
async function highlightElement(page, selector, options = {}) {
  const { color = '#2196F3', pulseColor = '#64B5F6', label = null } = options;

  await page.evaluate(({ selector, color, pulseColor, label }) => {
    // Remove any existing highlights
    document.querySelectorAll('.tutorial-highlight').forEach(el => el.remove());
    document.querySelectorAll('.tutorial-highlight-overlay').forEach(el => el.remove());

    const element = document.querySelector(selector);
    if (!element) return;

    const rect = element.getBoundingClientRect();

    // Create highlight overlay
    const highlight = document.createElement('div');
    highlight.className = 'tutorial-highlight';
    highlight.style.cssText = `
      position: fixed;
      top: ${rect.top - 4}px;
      left: ${rect.left - 4}px;
      width: ${rect.width + 8}px;
      height: ${rect.height + 8}px;
      border: 3px solid ${color};
      border-radius: 8px;
      box-shadow: 0 0 0 4px ${pulseColor}40, 0 0 20px ${color}60;
      pointer-events: none;
      z-index: 99999;
      animation: tutorialPulse 1.5s ease-in-out infinite;
    `;

    // Add label if provided
    if (label) {
      const labelEl = document.createElement('div');
      labelEl.className = 'tutorial-highlight';
      labelEl.style.cssText = `
        position: fixed;
        top: ${rect.top - 32}px;
        left: ${rect.left}px;
        background: ${color};
        color: white;
        padding: 4px 12px;
        border-radius: 4px;
        font-size: 14px;
        font-weight: 600;
        pointer-events: none;
        z-index: 99999;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      `;
      labelEl.textContent = label;
      document.body.appendChild(labelEl);
    }

    // Add keyframe animation
    if (!document.querySelector('#tutorial-highlight-styles')) {
      const style = document.createElement('style');
      style.id = 'tutorial-highlight-styles';
      style.textContent = `
        @keyframes tutorialPulse {
          0%, 100% {
            box-shadow: 0 0 0 4px ${pulseColor}40, 0 0 20px ${color}60;
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 0 8px ${pulseColor}20, 0 0 30px ${color}40;
            transform: scale(1.02);
          }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(highlight);
  }, { selector, color, pulseColor, label });

  // Wait for highlight to render
  await page.waitForTimeout(300);
}

// Helper to remove all highlights
async function removeHighlights(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.tutorial-highlight').forEach(el => el.remove());
    document.querySelectorAll('.tutorial-highlight-overlay').forEach(el => el.remove());
  });
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
  console.log('  The script will wait for you to reach the Dashboard');
  console.log('  (waiting up to 2 minutes)');
  console.log('==============================================');
  console.log('');

  // Wait for user to log in and reach dashboard
  try {
    await page.waitForSelector('text=Dashboard', { timeout: 120000 });
    console.log('Dashboard detected! Continuing in 3 seconds...');
    await page.waitForTimeout(3000);
  } catch (e) {
    console.log('Timeout waiting for Dashboard. Continuing anyway...');
  }

  console.log('Taking screenshots with highlights...');
  console.log('');

  try {
    // 1. Dashboard - highlight "Create New Project" card
    console.log('1. Dashboard (highlighting Create New Project)...');
    await page.click('text=Dashboard');
    await page.waitForTimeout(2000);

    // Find and highlight the Create New Project card
    const createCard = await page.$('text=Create New Project');
    if (createCard) {
      const box = await createCard.boundingBox();
      if (box) {
        await page.evaluate(({ top, left, width, height }) => {
          document.querySelectorAll('.tutorial-highlight').forEach(el => el.remove());
          const highlight = document.createElement('div');
          highlight.className = 'tutorial-highlight';
          highlight.style.cssText = `
            position: fixed;
            top: ${top - 60}px;
            left: ${left - 20}px;
            width: ${width + 40}px;
            height: ${height + 80}px;
            border: 3px solid #4CAF50;
            border-radius: 12px;
            box-shadow: 0 0 0 4px rgba(76, 175, 80, 0.3), 0 0 20px rgba(76, 175, 80, 0.4);
            pointer-events: none;
            z-index: 99999;
          `;
          document.body.appendChild(highlight);

          const label = document.createElement('div');
          label.className = 'tutorial-highlight';
          label.style.cssText = `
            position: fixed;
            top: ${top - 90}px;
            left: ${left - 20}px;
            background: #4CAF50;
            color: white;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 600;
            pointer-events: none;
            z-index: 99999;
          `;
          label.textContent = 'Click here';
          document.body.appendChild(label);
        }, box);
      }
    }
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '01-dashboard.png'),
      fullPage: false
    });
    console.log('   Saved: 01-dashboard.png');
    await removeHighlights(page);

    // 2. Create Project modal - highlight form fields
    console.log('2. Create Project modal (highlighting form)...');
    const createProjectCard = await page.$('text=Create New Project');
    if (createProjectCard) {
      await createProjectCard.click();
      await page.waitForTimeout(1000);

      // Highlight the project name input and submit button
      await page.evaluate(() => {
        const dialog = document.querySelector('.MuiDialog-root');
        if (!dialog) return;

        // Highlight all inputs in the dialog
        const inputs = dialog.querySelectorAll('input');
        inputs.forEach(input => {
          const rect = input.getBoundingClientRect();
          const highlight = document.createElement('div');
          highlight.className = 'tutorial-highlight';
          highlight.style.cssText = `
            position: fixed;
            top: ${rect.top - 4}px;
            left: ${rect.left - 4}px;
            width: ${rect.width + 8}px;
            height: ${rect.height + 8}px;
            border: 3px solid #2196F3;
            border-radius: 6px;
            box-shadow: 0 0 0 4px rgba(33, 150, 243, 0.3), 0 0 15px rgba(33, 150, 243, 0.4);
            pointer-events: none;
            z-index: 99999;
          `;
          document.body.appendChild(highlight);
        });

        // Highlight the submit button (find button containing "Create")
        const buttons = dialog.querySelectorAll('button');
        const submitBtn = Array.from(buttons).find(b => b.textContent.includes('Create'));
        if (submitBtn) {
          const rect = submitBtn.getBoundingClientRect();
          const highlight = document.createElement('div');
          highlight.className = 'tutorial-highlight';
          highlight.style.cssText = `
            position: fixed;
            top: ${rect.top - 4}px;
            left: ${rect.left - 4}px;
            width: ${rect.width + 8}px;
            height: ${rect.height + 8}px;
            border: 3px solid #4CAF50;
            border-radius: 6px;
            box-shadow: 0 0 0 4px rgba(76, 175, 80, 0.3), 0 0 15px rgba(76, 175, 80, 0.4);
            pointer-events: none;
            z-index: 99999;
          `;
          document.body.appendChild(highlight);
        }
      });

      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '02-create-project-modal.png'),
        fullPage: false
      });
      console.log('   Saved: 02-create-project-modal.png');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      await removeHighlights(page);
    } else {
      console.log('   Create Project card not found, skipping...');
    }

    // 3. Teams page - highlight "Add Employee" button
    console.log('3. Teams page (highlighting Add Employee button)...');
    await page.click('text=Teams');
    await page.waitForTimeout(2000);

    // Highlight Add Employee button
    const addEmployeeBtn = await page.$('button:has-text("Add Employee")');
    if (addEmployeeBtn) {
      const box = await addEmployeeBtn.boundingBox();
      if (box) {
        await page.evaluate(({ top, left, width, height }) => {
          const highlight = document.createElement('div');
          highlight.className = 'tutorial-highlight';
          highlight.style.cssText = `
            position: fixed;
            top: ${top - 4}px;
            left: ${left - 4}px;
            width: ${width + 8}px;
            height: ${height + 8}px;
            border: 3px solid #4CAF50;
            border-radius: 6px;
            box-shadow: 0 0 0 4px rgba(76, 175, 80, 0.3), 0 0 15px rgba(76, 175, 80, 0.4);
            pointer-events: none;
            z-index: 99999;
          `;
          document.body.appendChild(highlight);

          const label = document.createElement('div');
          label.className = 'tutorial-highlight';
          label.style.cssText = `
            position: fixed;
            top: ${top - 30}px;
            left: ${left}px;
            background: #4CAF50;
            color: white;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 600;
            pointer-events: none;
            z-index: 99999;
          `;
          label.textContent = 'Click here';
          document.body.appendChild(label);
        }, box);
      }
    }

    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '03-teams-page.png'),
      fullPage: false
    });
    console.log('   Saved: 03-teams-page.png');
    await removeHighlights(page);

    // 4. Add Employee modal - highlight form fields
    console.log('4. Add Employee modal (highlighting form)...');
    if (addEmployeeBtn) {
      await addEmployeeBtn.click();
      await page.waitForTimeout(1000);

      // Highlight form inputs and submit button
      await page.evaluate(() => {
        const inputs = document.querySelectorAll('.MuiDialog-root input');
        inputs.forEach((input, index) => {
          const rect = input.getBoundingClientRect();
          const highlight = document.createElement('div');
          highlight.className = 'tutorial-highlight';
          highlight.style.cssText = `
            position: fixed;
            top: ${rect.top - 4}px;
            left: ${rect.left - 4}px;
            width: ${rect.width + 8}px;
            height: ${rect.height + 8}px;
            border: 3px solid #2196F3;
            border-radius: 6px;
            box-shadow: 0 0 0 4px rgba(33, 150, 243, 0.3), 0 0 15px rgba(33, 150, 243, 0.4);
            pointer-events: none;
            z-index: 99999;
          `;
          document.body.appendChild(highlight);
        });

        // Highlight submit button
        const buttons = document.querySelectorAll('.MuiDialog-root button');
        const submitBtn = Array.from(buttons).find(b => b.textContent.includes('Add Employee'));
        if (submitBtn) {
          const rect = submitBtn.getBoundingClientRect();
          const highlight = document.createElement('div');
          highlight.className = 'tutorial-highlight';
          highlight.style.cssText = `
            position: fixed;
            top: ${rect.top - 4}px;
            left: ${rect.left - 4}px;
            width: ${rect.width + 8}px;
            height: ${rect.height + 8}px;
            border: 3px solid #4CAF50;
            border-radius: 6px;
            box-shadow: 0 0 0 4px rgba(76, 175, 80, 0.3), 0 0 15px rgba(76, 175, 80, 0.4);
            pointer-events: none;
            z-index: 99999;
          `;
          document.body.appendChild(highlight);
        }
      });

      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '04-add-employee-modal.png'),
        fullPage: false
      });
      console.log('   Saved: 04-add-employee-modal.png');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      await removeHighlights(page);
    } else {
      console.log('   Add Employee button not found, skipping...');
    }

    // 5. Create Team modal - highlight form
    console.log('5. Create Team modal (highlighting form)...');
    const createTeamBtn = await page.$('button:has-text("Create Team")');
    if (createTeamBtn) {
      await createTeamBtn.click();
      await page.waitForTimeout(1000);

      // Highlight form inputs and submit button
      await page.evaluate(() => {
        const inputs = document.querySelectorAll('.MuiDialog-root input');
        inputs.forEach((input) => {
          const rect = input.getBoundingClientRect();
          const highlight = document.createElement('div');
          highlight.className = 'tutorial-highlight';
          highlight.style.cssText = `
            position: fixed;
            top: ${rect.top - 4}px;
            left: ${rect.left - 4}px;
            width: ${rect.width + 8}px;
            height: ${rect.height + 8}px;
            border: 3px solid #2196F3;
            border-radius: 6px;
            box-shadow: 0 0 0 4px rgba(33, 150, 243, 0.3), 0 0 15px rgba(33, 150, 243, 0.4);
            pointer-events: none;
            z-index: 99999;
          `;
          document.body.appendChild(highlight);
        });

        // Highlight submit button
        const buttons = document.querySelectorAll('.MuiDialog-root button');
        const submitBtn = Array.from(buttons).find(b => b.textContent.includes('Create Team'));
        if (submitBtn) {
          const rect = submitBtn.getBoundingClientRect();
          const highlight = document.createElement('div');
          highlight.className = 'tutorial-highlight';
          highlight.style.cssText = `
            position: fixed;
            top: ${rect.top - 4}px;
            left: ${rect.left - 4}px;
            width: ${rect.width + 8}px;
            height: ${rect.height + 8}px;
            border: 3px solid #9C27B0;
            border-radius: 6px;
            box-shadow: 0 0 0 4px rgba(156, 39, 176, 0.3), 0 0 15px rgba(156, 39, 176, 0.4);
            pointer-events: none;
            z-index: 99999;
          `;
          document.body.appendChild(highlight);
        }
      });

      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '05-create-team-modal.png'),
        fullPage: false
      });
      console.log('   Saved: 05-create-team-modal.png');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      await removeHighlights(page);
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

    // 6. Shift Builder - highlight key areas
    console.log('6. Shift Builder (highlighting save button)...');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await page.click('text=Shift Builder');
    await page.waitForTimeout(2000);

    // Highlight Save button
    const saveBtn = await page.$('button:has-text("Save")');
    if (saveBtn) {
      const box = await saveBtn.boundingBox();
      if (box) {
        await page.evaluate(({ top, left, width, height }) => {
          const highlight = document.createElement('div');
          highlight.className = 'tutorial-highlight';
          highlight.style.cssText = `
            position: fixed;
            top: ${top - 4}px;
            left: ${left - 4}px;
            width: ${width + 8}px;
            height: ${height + 8}px;
            border: 3px solid #4CAF50;
            border-radius: 6px;
            box-shadow: 0 0 0 4px rgba(76, 175, 80, 0.3), 0 0 15px rgba(76, 175, 80, 0.4);
            pointer-events: none;
            z-index: 99999;
          `;
          document.body.appendChild(highlight);
        }, box);
      }
    }

    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '06-shift-builder.png'),
      fullPage: false
    });
    console.log('   Saved: 06-shift-builder.png');
    await removeHighlights(page);

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
