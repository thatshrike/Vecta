const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`BROWSER ERROR: ${msg.text()}`);
    } else {
      console.log(`BROWSER LOG: ${msg.text()}`);
    }
  });
  
  page.on('pageerror', error => {
    console.log(`PAGE EXCEPTION: ${error.message}`);
  });

  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    console.log('Page loaded');
    
    // Simulate upload flow
    // 1. Upload tender
    const tenderPath = path.resolve('../test_data/bhel/tender_bhel.pdf');
    const tenderInput = await page.$('input[type="file"][accept="application/pdf"]:not([multiple])');
    if (tenderInput) {
      await tenderInput.setInputFiles(tenderPath);
      console.log('Tender uploaded');
    }
    
    // 2. Upload bidder
    const bidderPath = path.resolve('../test_data/bhel/bidder_compliant.pdf');
    const bidderInput = await page.$('input[type="file"][multiple]');
    if (bidderInput) {
      await bidderInput.setInputFiles([bidderPath]);
      console.log('Bidder uploaded');
    }
    
    // 3. Click evaluate
    // The button text is "Start AI Evaluation & Extraction"
    const evalButton = await page.$('button:has-text("Start AI Evaluation")');
    if (evalButton) {
      await evalButton.click();
      console.log('Evaluation started');
    }
    
    // wait for results
    await page.waitForTimeout(5000);
    
  } catch (err) {
    console.error(`Script error: ${err.message}`);
  } finally {
    await browser.close();
  }
})();
