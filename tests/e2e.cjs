const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('fs');
const path=require('path'),os=require('os');const root=path.resolve(__dirname,'..','..');const project=path.resolve(__dirname,'..');const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'taskready-e2e-'));const artifacts=path.join(tmp,'artifacts');fs.mkdirSync(artifacts);
const server=require('child_process').spawn(process.env.TASKREADY_PYTHON||'python3',['-m','uvicorn','backend.main:app','--host','127.0.0.1','--port','8765'],{cwd:project,env:{...process.env,TASKREADY_DB_PATH:path.join(tmp,'test.sqlite3')},stdio:'ignore'});
(async()=>{
 for(let i=0;i<50;i++){try{await fetch('http://127.0.0.1:8765/api/health');break}catch{await new Promise(r=>setTimeout(r,100))}}
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-gpu']});
 const errors=[];const c1=await browser.newContext({viewport:{width:1440,height:1000}}),c2=await browser.newContext({viewport:{width:1440,height:1000}});
 const b=await c1.newPage(),t=await c2.newPage();for(const p of [b,t])p.on('pageerror',e=>errors.push(e.message));
 async function register(p,email,role,name){await p.goto('http://127.0.0.1:8765');await p.locator('.auth-toggle').click();await p.locator('[name="name"]').fill(name);await p.locator('[name="role"]').selectOption(role);await p.locator('[name="email"]').fill(email);await p.locator('[name="password"]').fill('TestPassword123!');await p.locator('[type="submit"]').click();await p.locator('.overview-heading').waitFor();}
 await b.goto('http://127.0.0.1:8765');await b.screenshot({path:artifacts+'/TaskReady-login.png',fullPage:true});
 const stamp=Date.now();await register(b,`business${stamp}@example.com`,'business','Анса · Бизнес');
 await b.locator('.sidebar-create').click();await b.locator('#load-example').click();await b.locator('[data-action="analyze"]').click();await b.locator('.question-answer').first().waitFor();
 const answers=await b.evaluate(()=>DEMO_CASE.answers);for(const field of Object.keys(answers)){const x=b.locator(`.question-answer[data-field="${field}"]`);if(await x.count())await x.fill(answers[field]);}
 await b.locator('[data-action="build-card"]').click();for(const [field,value] of Object.entries(answers))await b.locator(`.draft-field[data-field="${field}"]`).fill(value);
 await b.locator('[data-field="title"]').fill('Импорт заявок без ручного копирования');
 assert.equal(await b.locator('.score-number').textContent(),'100');await b.evaluate(()=>window.scrollTo(0,0));await b.screenshot({path:artifacts+'/TaskReady-readiness.png',fullPage:true});
 await b.locator('#confirm-card').check();await b.locator('[data-action="publish-draft"]').click();await b.locator('#catalog-list').waitFor();
 await b.reload();await b.locator('#catalog-list, .overview-heading').first().waitFor();assert.equal(await b.evaluate(()=>state.tasks.length),1);
 await register(t,`team${stamp}@example.com`,'team','Data Nomads');assert.equal(await t.locator('.sidebar-create').count(),0);
 await t.locator('.nav [data-view="catalog"]').click();await t.locator('[data-task]').first().click();
 await t.locator('#offer-idea').fill('Импортируем CSV и распределяем заявки по менеджерам.');await t.locator('#offer-plan').fill('За 10 дней создадим реестр, импорт и журнал ошибок. Проверим на 20 примерах.');await t.locator('#offer-deadline').fill('10 дней');await t.locator('[data-submit-offer]').click();await t.locator('.offer-card').waitFor();
 await b.reload();await b.locator('.overview-heading').waitFor();await b.locator('.nav [data-view="offers"]').click();await b.locator('[data-decision="accept"]').click();await b.locator('[data-decision="progress"]').waitFor();await b.locator('[data-decision="progress"]').click();await b.locator('#progress-evidence').fill('Проверили импорт на 20 примерах. Все заявки попали в реестр без потери полей.');await b.locator('#confirm-progress').click();await b.locator('.progress-confirmed').waitFor();assert.equal(await b.locator('[data-decision="progress"]').count(),0);await b.screenshot({path:artifacts+'/TaskReady-decisions.png',fullPage:true});
 await t.reload();await t.locator('.overview-heading').waitFor();await t.locator('.nav [data-view="offers"]').click();assert((await t.locator('.heading-actions, .page-heading').allTextContents()).join(' ').includes('15 баллов'));
 const offline=await browser.newPage({viewport:{width:1440,height:1100}});offline.on('pageerror',e=>errors.push(e.message));await offline.goto('file://'+project+'/TaskReady-demo.html');await offline.locator('.overview-heading').waitFor();await offline.screenshot({path:artifacts+'/TaskReady-preview.png',fullPage:true});await offline.setViewportSize({width:390,height:844});assert.equal(await offline.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await offline.screenshot({path:artifacts+'/TaskReady-mobile.png',fullPage:true});
 console.log(JSON.stringify({errors,artifacts,serverWorkflow:'passed with separate business/team accounts',points:15,score:100,mobileOverflow:false}));assert.deepEqual(errors,[]);
 await browser.close();server.kill();
})().catch(e=>{console.error(e);server.kill();process.exit(1)});
