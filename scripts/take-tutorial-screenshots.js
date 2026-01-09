// Tutorial Screenshot Script with Element Highlights
// Launches a new browser - you'll need to log in manually
//
// Usage: node scripts/take-tutorial-screenshots.js
//
// Screenshots naming convention:
// XX-YY-description.png where XX = tutorial number, YY = step number

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOTS_DIR = path.join(__dirname, '../public/tutorials');
const APP_URL = 'http://localhost:3000';

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Helper function to add highlight to an element
async function highlightElement(page, selector, options = {}) {
  const { color = '#4CAF50', label = null, padding = 4 } = options;
  const pulseColor = color;

  await page.evaluate(({ selector, color, pulseColor, label, padding }) => {
    // Remove any existing highlights
    document.querySelectorAll('.tutorial-highlight').forEach(el => el.remove());

    const element = document.querySelector(selector);
    if (!element) {
      console.log('Element not found:', selector);
      return;
    }

    const rect = element.getBoundingClientRect();

    // Create highlight overlay
    const highlight = document.createElement('div');
    highlight.className = 'tutorial-highlight';
    highlight.style.cssText = `
      position: fixed;
      top: ${rect.top - padding}px;
      left: ${rect.left - padding}px;
      width: ${rect.width + padding * 2}px;
      height: ${rect.height + padding * 2}px;
      border: 3px solid ${color};
      border-radius: 8px;
      box-shadow: 0 0 0 4px ${pulseColor}40, 0 0 20px ${color}60;
      pointer-events: none;
      z-index: 99999;
    `;
    document.body.appendChild(highlight);

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
  }, { selector, color, pulseColor, label, padding });

  await page.waitForTimeout(300);
}

// Helper to highlight by bounding box (for elements found by text)
async function highlightBoundingBox(page, box, options = {}) {
  const { color = '#4CAF50', label = null, padding = 4 } = options;

  await page.evaluate(({ box, color, label, padding }) => {
    document.querySelectorAll('.tutorial-highlight').forEach(el => el.remove());

    const highlight = document.createElement('div');
    highlight.className = 'tutorial-highlight';
    highlight.style.cssText = `
      position: fixed;
      top: ${box.y - padding}px;
      left: ${box.x - padding}px;
      width: ${box.width + padding * 2}px;
      height: ${box.height + padding * 2}px;
      border: 3px solid ${color};
      border-radius: 8px;
      box-shadow: 0 0 0 4px ${color}40, 0 0 20px ${color}60;
      pointer-events: none;
      z-index: 99999;
    `;
    document.body.appendChild(highlight);

    if (label) {
      const labelEl = document.createElement('div');
      labelEl.className = 'tutorial-highlight';
      labelEl.style.cssText = `
        position: fixed;
        top: ${box.y - 32}px;
        left: ${box.x}px;
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
  }, { box, color, label, padding });

  await page.waitForTimeout(300);
}

// Helper to remove all highlights
async function removeHighlights(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.tutorial-highlight').forEach(el => el.remove());
  });
}

// Helper to take a screenshot
async function screenshot(page, filename) {
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, filename),
    fullPage: false
  });
  console.log(`   Saved: ${filename}`);
}

// Helper to wait and escape any open modals
async function closeModals(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
}

async function takeScreenshots() {
  console.log('Launching browser...');
  console.log('');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 200
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });

  const page = await context.newPage();

  console.log(`Opening ${APP_URL}...`);
  await page.goto(APP_URL);

  console.log('');
  console.log('==============================================');
  console.log('  Please LOG IN to the application now');
  console.log('  The script will wait for you to reach the Dashboard');
  console.log('  (waiting up to 2 minutes)');
  console.log('==============================================');
  console.log('');

  try {
    await page.waitForSelector('text=Dashboard', { timeout: 120000 });
    console.log('Dashboard detected! Starting in 3 seconds...');
    await page.waitForTimeout(3000);
  } catch (e) {
    console.log('Timeout waiting for Dashboard. Continuing anyway...');
  }

  console.log('Taking screenshots...');
  console.log('');

  try {
    // =========================================
    // TUTORIAL 01: CREATE PROJECT
    // =========================================
    console.log('=== Tutorial 01: Create Project ===');

    // 01-01: Dashboard overview
    console.log('01-01: Dashboard overview...');
    await page.click('text=Dashboard');
    await page.waitForTimeout(2000);
    await screenshot(page, '01-01-dashboard.png');

    // 01-02: Dashboard with Create New Project card highlighted
    console.log('01-02: Dashboard - Create New Project card...');
    const createProjectCard = await page.$('text=Create New Project');
    if (createProjectCard) {
      const box = await createProjectCard.boundingBox();
      if (box) {
        // Expand the box to cover the card
        await highlightBoundingBox(page, { x: box.x - 20, y: box.y - 60, width: box.width + 40, height: box.height + 80 }, { color: '#4CAF50', label: 'Click here' });
      }
    }
    await screenshot(page, '01-02-dashboard-create-project-card.png');
    await removeHighlights(page);

    // 01-03: Create Project modal
    console.log('01-03: Create Project modal...');
    if (createProjectCard) {
      await createProjectCard.click();
      await page.waitForTimeout(1000);
      await screenshot(page, '01-03-create-project-modal.png');

      // 01-04: Create Project modal with button highlighted
      console.log('01-04: Create Project modal - button...');
      await highlightElement(page, '.MuiDialog-root button.MuiButton-contained', { color: '#4CAF50', label: 'Click to create' });
      await screenshot(page, '01-04-create-project-modal-button.png');
      await removeHighlights(page);
      await closeModals(page);
    }

    // =========================================
    // TUTORIAL 02: ADD EMPLOYEE
    // =========================================
    console.log('');
    console.log('=== Tutorial 02: Add Employee ===');

    // 02-01: Teams page overview
    console.log('02-01: Teams page overview...');
    await page.click('text=Team Management');
    await page.waitForTimeout(2000);
    await screenshot(page, '02-01-teams.png');

    // 02-02: Teams page with Add Employee button highlighted
    console.log('02-02: Teams - Add Employee button...');
    const addEmployeeBtn = await page.$('button:has-text("Add Employee")');
    if (addEmployeeBtn) {
      const box = await addEmployeeBtn.boundingBox();
      if (box) {
        await highlightBoundingBox(page, box, { color: '#4CAF50', label: 'Click here' });
      }
    }
    await screenshot(page, '02-02-teams-add-employee-button.png');
    await removeHighlights(page);

    // 02-03: Add Employee modal
    console.log('02-03: Add Employee modal...');
    if (addEmployeeBtn) {
      await addEmployeeBtn.click();
      await page.waitForTimeout(1000);
      await screenshot(page, '02-03-add-employee-modal.png');

      // 02-04: Add Employee modal with role field highlighted
      console.log('02-04: Add Employee modal - role field...');
      // Find the role input (usually the 3rd input)
      await page.evaluate(() => {
        const inputs = document.querySelectorAll('.MuiDialog-root input');
        if (inputs[2]) {
          const rect = inputs[2].getBoundingClientRect();
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
            box-shadow: 0 0 0 4px rgba(33, 150, 243, 0.3);
            pointer-events: none;
            z-index: 99999;
          `;
          document.body.appendChild(highlight);
        }
      });
      await screenshot(page, '02-04-add-employee-modal-role.png');
      await removeHighlights(page);

      // 02-05: Add Employee modal with button highlighted
      console.log('02-05: Add Employee modal - button...');
      await highlightElement(page, '.MuiDialog-root button.MuiButton-contained', { color: '#4CAF50', label: 'Click to add' });
      await screenshot(page, '02-05-add-employee-modal-button.png');
      await removeHighlights(page);
      await closeModals(page);
    }

    // =========================================
    // TUTORIAL 03: IMPORT EMPLOYEES
    // =========================================
    console.log('');
    console.log('=== Tutorial 03: Import Employees ===');

    // 03-02: Teams page with Import CSV button highlighted
    console.log('03-02: Teams - Import CSV button...');
    await page.click('text=Team Management');
    await page.waitForTimeout(1000);
    const importCsvBtn = await page.$('button:has-text("Import CSV")');
    if (importCsvBtn) {
      const box = await importCsvBtn.boundingBox();
      if (box) {
        await highlightBoundingBox(page, box, { color: '#FF9800', label: 'Click here' });
      }
    }
    await screenshot(page, '03-02-teams-import-csv-button.png');
    await removeHighlights(page);

    // 03-03: Import CSV modal
    console.log('03-03: Import CSV modal...');
    if (importCsvBtn) {
      await importCsvBtn.click();
      await page.waitForTimeout(1000);
      await screenshot(page, '03-03-import-csv-modal.png');

      // 03-04: Import CSV modal (same as above for now, would need actual CSV)
      console.log('03-04: Import CSV modal - mapped...');
      await screenshot(page, '03-04-import-csv-modal-mapped.png');
      await closeModals(page);
    }

    // =========================================
    // TUTORIAL 04: CREATE TEAM
    // =========================================
    console.log('');
    console.log('=== Tutorial 04: Create Team ===');

    // 04-02: Teams page with Create Team button highlighted
    console.log('04-02: Teams - Create Team button...');
    await page.click('text=Team Management');
    await page.waitForTimeout(1000);
    const createTeamBtn = await page.$('button:has-text("Create Team")');
    if (createTeamBtn) {
      const box = await createTeamBtn.boundingBox();
      if (box) {
        await highlightBoundingBox(page, box, { color: '#9C27B0', label: 'Click here' });
      }
    }
    await screenshot(page, '04-02-teams-create-team-button.png');
    await removeHighlights(page);

    // 04-03: Create Team modal
    console.log('04-03: Create Team modal...');
    if (createTeamBtn) {
      await createTeamBtn.click();
      await page.waitForTimeout(1000);
      await screenshot(page, '04-03-create-team-modal.png');

      // 04-04: Create Team modal with member selection highlighted
      console.log('04-04: Create Team modal - members...');
      // Highlight the member selection area
      await page.evaluate(() => {
        const memberList = document.querySelector('.MuiDialog-root .MuiList-root');
        if (memberList) {
          const rect = memberList.getBoundingClientRect();
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
            box-shadow: 0 0 0 4px rgba(33, 150, 243, 0.3);
            pointer-events: none;
            z-index: 99999;
          `;
          document.body.appendChild(highlight);
        }
      });
      await screenshot(page, '04-04-create-team-modal-members.png');
      await removeHighlights(page);

      // 04-05: Create Team modal with button highlighted
      console.log('04-05: Create Team modal - button...');
      await highlightElement(page, '.MuiDialog-root button.MuiButton-contained', { color: '#9C27B0', label: 'Click to create' });
      await screenshot(page, '04-05-create-team-modal-button.png');
      await removeHighlights(page);
      await closeModals(page);
    }

    // =========================================
    // TUTORIAL 05: CREATE SHIFT PATTERN
    // =========================================
    console.log('');
    console.log('=== Tutorial 05: Create Shift Pattern ===');

    // 05-01: Shift Builder overview
    console.log('05-01: Shift Builder overview...');
    await page.click('text=Shift Builder');
    await page.waitForTimeout(2000);
    await screenshot(page, '05-01-shiftbuilder.png');

    // 05-02: Shift Builder with project dropdown highlighted
    console.log('05-02: Shift Builder - project dropdown...');
    const projectDropdown = await page.$('.MuiSelect-select');
    if (projectDropdown) {
      const box = await projectDropdown.boundingBox();
      if (box) {
        await highlightBoundingBox(page, box, { color: '#2196F3', label: 'Select project' });
      }
    }
    await screenshot(page, '05-02-shiftbuilder-project-dropdown.png');
    await removeHighlights(page);

    // 05-03: Shift Builder with days configuration highlighted
    console.log('05-03: Shift Builder - days configuration...');
    // Highlight the days grid area
    await page.evaluate(() => {
      // Find the days configuration area (look for the grid with checkboxes)
      const gridArea = document.querySelector('[class*="grid"]') || document.querySelector('table');
      if (gridArea) {
        const rect = gridArea.getBoundingClientRect();
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
          box-shadow: 0 0 0 4px rgba(33, 150, 243, 0.3);
          pointer-events: none;
          z-index: 99999;
        `;
        document.body.appendChild(highlight);
      }
    });
    await screenshot(page, '05-03-shiftbuilder-days-config.png');
    await removeHighlights(page);

    // 05-04: Shift Builder with save button highlighted
    console.log('05-04: Shift Builder - save button...');
    const saveBtn = await page.$('button:has-text("Save")');
    if (saveBtn) {
      const box = await saveBtn.boundingBox();
      if (box) {
        await highlightBoundingBox(page, box, { color: '#4CAF50', label: 'Click to save' });
      }
    }
    await screenshot(page, '05-04-shiftbuilder-save-button.png');
    await removeHighlights(page);

    // =========================================
    // TUTORIAL 06: ASSIGN SHIFT
    // =========================================
    console.log('');
    console.log('=== Tutorial 06: Assign Shift ===');

    // 06-01: Dashboard with project card highlighted
    console.log('06-01: Dashboard - project card...');
    await page.click('text=Dashboard');
    await page.waitForTimeout(2000);
    // Find a project card (not Create New Project)
    const projectCards = await page.$$('.MuiCard-root');
    for (const card of projectCards) {
      const text = await card.textContent();
      if (text && !text.includes('Create New Project') && text.includes('Open Planning')) {
        const box = await card.boundingBox();
        if (box) {
          await highlightBoundingBox(page, box, { color: '#2196F3', label: 'Click a project' });
        }
        break;
      }
    }
    await screenshot(page, '06-01-dashboard-project-card.png');
    await removeHighlights(page);

    // 06-02: Planning view
    console.log('06-02: Planning view...');
    const openPlanningBtn = await page.$('button:has-text("Open Planning")');
    if (openPlanningBtn) {
      await openPlanningBtn.click();
      await page.waitForTimeout(2000);
      await screenshot(page, '06-02-planning.png');

      // 06-02b: Planning view with employee panel highlighted
      console.log('06-02b: Planning - employee panel...');
      // Highlight the bottom employee panel
      await page.evaluate(() => {
        // Find the employee panel at the bottom
        const panels = document.querySelectorAll('[class*="MuiBox"]');
        for (const panel of panels) {
          if (panel.textContent && panel.textContent.includes('Employees') && panel.textContent.includes('Teams')) {
            const rect = panel.getBoundingClientRect();
            if (rect.top > 400) { // It's at the bottom
              const highlight = document.createElement('div');
              highlight.className = 'tutorial-highlight';
              highlight.style.cssText = `
                position: fixed;
                top: ${rect.top - 4}px;
                left: ${rect.left - 4}px;
                width: ${rect.width + 8}px;
                height: ${rect.height + 8}px;
                border: 3px solid #FF9800;
                border-radius: 6px;
                box-shadow: 0 0 0 4px rgba(255, 152, 0, 0.3);
                pointer-events: none;
                z-index: 99999;
              `;
              document.body.appendChild(highlight);
              break;
            }
          }
        }
      });
      await screenshot(page, '06-02-planning-employee-panel.png');
      await removeHighlights(page);

      // 06-03: Planning view (drag action - just show the view)
      console.log('06-03: Planning - drag assign area...');
      await screenshot(page, '06-03-planning-drag-assign.png');

      // 06-04: Shift pattern select modal (need to trigger it)
      console.log('06-04: Shift pattern select modal...');
      // This would need actual drag-drop, so we'll just take another planning screenshot
      await screenshot(page, '06-04-shift-pattern-select-modal.png');

      // 06-05: Planning with assignments
      console.log('06-05: Planning - with assignments...');
      await screenshot(page, '06-05-planning-with-assignments.png');
    } else {
      console.log('   No Open Planning button found, skipping planning screenshots...');
    }

    // =========================================
    // TUTORIAL 07: VIEW COMPLIANCE
    // =========================================
    console.log('');
    console.log('=== Tutorial 07: View Compliance ===');

    // Navigate back to planning if needed
    if (!openPlanningBtn) {
      await page.click('text=Dashboard');
      await page.waitForTimeout(1000);
      const btn = await page.$('button:has-text("Open Planning")');
      if (btn) await btn.click();
      await page.waitForTimeout(2000);
    }

    // 07-01: Planning with compliance colors
    console.log('07-01: Planning - compliance colors...');
    await screenshot(page, '07-01-planning-compliance-colors.png');

    // 07-02: Planning with tooltip (hover simulation)
    console.log('07-02: Planning - tooltip...');
    // Try to hover over an employee card
    const employeeCard = await page.$('[draggable="true"]');
    if (employeeCard) {
      await employeeCard.hover();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, '07-02-planning-tooltip.png');

    // 07-03: Weekly view
    console.log('07-03: Planning - weekly view...');
    const weeklyBtn = await page.$('button:has-text("Weekly")');
    if (weeklyBtn) {
      await weeklyBtn.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, '07-03-planning-weekly-view.png');

    // 07-04: Planning with project dropdown highlighted
    console.log('07-04: Planning - project dropdown...');
    // Switch back to timeline
    const timelineBtn = await page.$('button:has-text("Timeline")');
    if (timelineBtn) {
      await timelineBtn.click();
      await page.waitForTimeout(1000);
    }
    // Highlight the project dropdown in header
    const headerDropdown = await page.$('header .MuiSelect-select, .MuiAppBar-root .MuiSelect-select');
    if (headerDropdown) {
      const box = await headerDropdown.boundingBox();
      if (box) {
        await highlightBoundingBox(page, box, { color: '#2196F3', label: 'Switch projects' });
      }
    }
    await screenshot(page, '07-04-planning-project-dropdown.png');
    await removeHighlights(page);

    console.log('');
    console.log('==============================================');
    console.log('  All screenshots saved to: public/tutorials/');
    console.log('==============================================');
    console.log('');

  } catch (error) {
    console.error('Error taking screenshots:', error.message);
    console.error(error.stack);
  }

  console.log('Browser will close in 10 seconds...');
  console.log('(Press Ctrl+C to close earlier)');
  await page.waitForTimeout(10000);
  await browser.close();
}

takeScreenshots().catch(console.error);
