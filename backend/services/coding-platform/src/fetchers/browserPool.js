const puppeteer = require('puppeteer');
const config = require('../config/config');
const logger = require('../utils/logger');

let browser = null;

async function getBrowser() {
  if (browser && browser.isConnected()) return browser;

  logger.info('Launching Puppeteer browser...');
  browser = await puppeteer.launch({
    headless: config.puppeteer.headless ? 'new' : false,
    executablePath: config.puppeteer.executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
    ],
  });

  browser.on('disconnected', () => {
    logger.warn('Puppeteer browser disconnected');
    browser = null;
  });

  return browser;
}

async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    logger.info('Puppeteer browser closed');
  }
}

async function withPage(fn) {
  const b = await getBrowser();
  const page = await b.newPage();
  await page.setUserAgent(config.userAgent);
  await page.setDefaultNavigationTimeout(config.puppeteer.timeout);

  try {
    return await fn(page);
  } finally {
    await page.close();
  }
}

module.exports = { getBrowser, closeBrowser, withPage };
