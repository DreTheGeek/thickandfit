const path=require('path');
const puppeteer=require(path.join(process.env.HOME||process.env.USERPROFILE,'.launchproof/runtime/node_modules/puppeteer-core'));
const CHROME='C:\Program Files\Google\Chrome\Application\chrome.exe';
const BASE='https://thicknfit.kaldrtech.com';
(async()=>{const b=await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox']});const p=await b.newPage();
await p.goto(`${BASE}/auth/sign-in`,{waitUntil:'networkidle2',timeout:60000});
await p.type('input[name=email]','sample.sam@thickandfit.test');await p.type('input[name=password]','TFSample2026!');
await Promise.all([p.waitForNavigation({waitUntil:'networkidle2'}).catch(()=>{}),p.click('button[type=submit]')]);
await new Promise(r=>setTimeout(r,2500));
for(const route of ['/nutrition','/coach-chat','/community','/progress','/notifications']){
  const perr=[];const ph=e=>perr.push(e.message.slice(0,70));p.on('pageerror',ph);
  let st=0;try{const r=await p.goto(`${BASE}${route}`,{waitUntil:'networkidle2',timeout:45000});st=r?r.status():0;}catch(e){perr.push('NAV');}
  await new Promise(r=>setTimeout(r,1200));p.off('pageerror',ph);
  const fp=new URL(p.url()).pathname;
  console.log(`${st===200&&fp===route&&!perr.length?'ok  ':'FLAG'} ${st} ${route}${fp!==route?' ->'+fp:''}${perr.length?' ERR:'+perr[0]:''}`);
}
await b.close();console.log('done');})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
