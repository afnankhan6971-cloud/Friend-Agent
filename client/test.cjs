const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));
  
  await page.goto('http://localhost:5174');
  
  // Wait for Auth or Chat
  await page.waitForTimeout(2000);
  
  // If we are on Auth page, sign up
  const isAuth = await page.$('input[type="email"]');
  if (isAuth) {
    console.log("On Auth page, signing up...");
    await page.fill('input[type="email"]', 'agent@test.com');
    await page.fill('input[type="password"]', 'Password123!');
    
    // Check if Confirm Email is off. Actually, let's just click Sign Up.
    // If rate limited, click Login instead
    try {
      await page.click('button:has-text("Sign Up")');
      await page.waitForTimeout(2000);
      const text = await page.content();
      if (text.includes('email rate limit exceeded') || text.includes('error')) {
        console.log("Signup failed, trying login...");
        await page.click('button:has-text("Sign in")');
        await page.click('button:has-text("Login")');
      }
    } catch (e) { }
  }
  
  await page.waitForTimeout(3000);
  
  // Now we should be on Chat page
  const hasTextarea = await page.$('textarea');
  if (hasTextarea) {
    console.log("On Chat page! Typing message...");
    await page.fill('textarea', 'Hello from playwright!');
    console.log("Clicking send...");
    await page.click('button:has-text("")'); // Wait, button has icon, no text.
    await page.click('button:has(svg.lucide-send)');
    
    await page.waitForTimeout(2000);
    console.log("Test finished.");
  } else {
    console.log("No textarea found.");
  }
  
  await browser.close();
})();
