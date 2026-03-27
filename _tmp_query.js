// Temporary script - test feishu sync-contacts via HTTP
// Dev server must be running on port 3001

// Step 1: Get captcha
const captchaRes = await fetch('http://localhost:3001/api/auth/captcha');
const captcha = await captchaRes.json();
console.log('Captcha prompt:', captcha.data?.prompt);

// Step 2: Parse answer positions from token (format: timestamp.x1,y1|x2,y2|x3,y3.signature)
const token = captcha.data?.token || '';
const parts = token.split('.');
const answerData = parts[1] || '';
const clicks = answerData.split('|').map(pair => {
  const [x, y] = pair.split(',').map(Number);
  return { x, y };
});
console.log('Clicks:', clicks);

const loginRes = await fetch('http://localhost:3001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    account: 'admin@docflow.local',
    password: 'Docflow@123',
    captchaToken: token,
    captchaClicks: clicks,
  }),
});
const loginData = await loginRes.json();
console.log('Login:', loginData.success ? 'OK' : loginData.message);

if (!loginData.success) {
  process.exit(1);
}

const jwt = loginData.data.token;

// Step 3: Call sync-contacts
console.log('\nCalling sync-contacts...');
const syncRes = await fetch('http://localhost:3001/api/integrations/feishu/sync-contacts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwt}`,
  },
});
const syncData = await syncRes.json();
console.log('Sync result:', JSON.stringify(syncData, null, 2));
