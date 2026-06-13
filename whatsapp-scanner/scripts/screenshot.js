'use strict';
const puppeteer = require('puppeteer');

(async () => {
  const url = process.env.URL || 'http://localhost:3111/';
  const out = process.env.OUT || '/tmp/painel.png';
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1180, height: 1500, deviceScaleFactor: 2 });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1500)); // deixa o JS carregar dados
  await page.screenshot({ path: out, fullPage: true });
  await browser.close();
  console.log('screenshot salvo em', out);
})().catch((e) => { console.error(e); process.exit(1); });
