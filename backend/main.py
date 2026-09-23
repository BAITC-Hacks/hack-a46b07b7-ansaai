from __future__ import annotations
import hashlib, hmac, json, os, re, secrets, sqlite3, time, uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit
from fastapi import FastAPI, Depends, HTTPException, Request, Response
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator
from . import ai
from .scoring import FIELDS, score_task

ROOT=Path(__file__).resolve().parents[1]
DB_PATH=Path(os.getenv('TASKREADY_DB_PATH',str(ROOT/'data/taskready-v3.sqlite3')))
PRODUCTION=os.getenv('APP_ENV','development')=='production'
COOKIE='taskready_session'
app=FastAPI(title='TaskReady API',version='0.3.0')

@contextmanager
def db():
    DB_PATH.parent.mkdir(parents=True,exist_ok=True)
    con=sqlite3.connect(DB_PATH,timeout=15);con.row_factory=sqlite3.Row
    con.execute('PRAGMA foreign_keys=ON');con.execute('PRAGMA journal_mode=WAL')
    con.executescript('''
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('business','team')),password TEXT NOT NULL,created REAL NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,csrf TEXT NOT NULL,expires REAL NOT NULL);
    CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),payload TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,created REAL NOT NULL);
    CREATE TABLE IF NOT EXISTS offers(id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(id),team_id TEXT NOT NULL REFERENCES users(id),idea TEXT NOT NULL,plan TEXT NOT NULL,prototype TEXT NOT NULL,deadline TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('pending','accepted','rejected')),created REAL NOT NULL,UNIQUE(task_id,team_id));
    CREATE TABLE IF NOT EXISTS ledger(offer_id TEXT NOT NULL REFERENCES offers(id),kind TEXT NOT NULL CHECK(kind IN ('start','progress')),team_id TEXT NOT NULL REFERENCES users(id),points INTEGER NOT NULL,evidence TEXT NOT NULL,created REAL NOT NULL,PRIMARY KEY(offer_id,kind));
    CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT,actor TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,created REAL NOT NULL);
    CREATE TABLE IF NOT EXISTS rate_limits(bucket TEXT PRIMARY KEY,count INTEGER NOT NULL,expires REAL NOT NULL);
    ''')
    try:yield con;con.commit()
    except BaseException:con.rollback();raise
    finally:con.close()

def uid():return uuid.uuid4().hex

def audit(c,user,action,target):c.execute('INSERT INTO audit(actor,action,target,created) VALUES(?,?,?,?)',(user,action,target,time.time()))

def password_hash(password,salt=None):
    salt=salt or secrets.token_hex(16)
    return salt+':'+hashlib.pbkdf2_hmac('sha256',password.encode(),salt.encode(),600000).hex()

def password_ok(password,stored):return hmac.compare_digest(password_hash(password,stored.split(':')[0]),stored)

def rate_limit(key,limit=30,seconds=60):
    now=time.time()
    with db() as c:
        c.execute('BEGIN IMMEDIATE')
        c.execute('DELETE FROM rate_limits WHERE expires<?',(now,))
        r=c.execute('SELECT count FROM rate_limits WHERE bucket=?',(key,)).fetchone()
        if r and r['count']>=limit:raise HTTPException(429,'Слишком много попыток. Подождите минуту.')
        c.execute('INSERT INTO rate_limits VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1',(key,now+seconds))

def user_dict(row):return {k:row[k] for k in ('id','email','name','role')}

def current_user(request:Request):
    token=request.cookies.get(COOKIE,'')
    with db() as c:
        row=c.execute('SELECT u.*,s.csrf FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>?',(hashlib.sha256(token.encode()).hexdigest(),time.time())).fetchone()
    if not row:raise HTTPException(401,'Войдите в аккаунт.')
    if request.method not in ('GET','HEAD','OPTIONS') and not hmac.compare_digest(request.headers.get('x-csrf-token',''),row['csrf']):raise HTTPException(403,'Сессия устарела. Обновите страницу.')
    return dict(row)

def role(user,expected):
    if user['role']!=expected:raise HTTPException(403,'У этой роли нет права на действие.')

def session(response,user_id):
    token=secrets.token_urlsafe(48);csrf=secrets.token_urlsafe(32)
    with db() as c:
        c.execute('DELETE FROM sessions WHERE expires<?',(time.time(),))
        c.execute('INSERT INTO sessions VALUES(?,?,?,?)',(hashlib.sha256(token.encode()).hexdigest(),user_id,csrf,time.time()+86400*7))
    response.set_cookie(COOKIE,token,max_age=86400*7,httponly=True,secure=PRODUCTION,samesite='strict',path='/')
    return csrf

@app.middleware('http')
async def guards(request,call_next):
    if request.method not in ('GET','HEAD','OPTIONS'):
        origin=request.headers.get('origin')
        allowed=os.getenv('TASKREADY_PUBLIC_ORIGIN','').rstrip('/')
        if origin and (urlsplit(origin).netloc!=request.headers.get('host') if not allowed else origin!=allowed):return JSONResponse({'detail':'Недопустимый источник запроса.'},403)
        length=request.headers.get('content-length','0')
        if not length.isdigit() or int(length)>65536:return JSONResponse({'detail':'Слишком большой запрос.'},413)
        body=await request.body()
        if len(body)>65536:return JSONResponse({'detail':'Слишком большой запрос.'},413)
    response=await call_next(request)
    response.headers['X-Content-Type-Options']='nosniff'
    response.headers['X-Frame-Options']='DENY'
    response.headers['Referrer-Policy']='same-origin'
    if request.url.path.startswith('/api/'):
        response.headers['Cache-Control']='no-store'
    return response

class StrictModel(BaseModel):model_config=ConfigDict(extra='forbid',str_strip_whitespace=True)
class Register(StrictModel):
    email:str=Field(min_length=5,max_length=160)
    password:str=Field(min_length=10,max_length=128)
    name:str=Field(min_length=2,max_length=80)
    role:Literal['business','team']
    @field_validator('email')
    @classmethod
    def email_check(cls,v):
        if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',v):raise ValueError('Некорректный email')
        return v.lower()
class Login(StrictModel):
    email:str=Field(max_length=160)
    password:str=Field(max_length=128)
class Card(StrictModel):
    title:str=Field(min_length=3,max_length=180)
    industry:str=Field(default='Другое',max_length=80)
    context:str=Field(min_length=15,max_length=4000)
    data:str=Field(default='',max_length=4000)
    expected:str=Field(default='',max_length=4000)
    success:str=Field(default='',max_length=4000)
    constraints:str=Field(default='',max_length=4000)
    users:str=Field(default='',max_length=4000)
    business:str=Field(default='',max_length=4000)
    contact:str=Field(default='',max_length=160)
    interaction:str=Field(default='Онлайн-встречи',max_length=80)
    confirmed:bool=False
    clientId:str=Field(min_length=8,max_length=80)
class CardUpdate(Card):version:int=Field(ge=1)
class Analyze(StrictModel):
    raw:str=Field(min_length=15,max_length=6000)
    answers:dict[str,str]=Field(default_factory=dict)
    local:bool=False
    @field_validator('answers')
    @classmethod
    def validate_answers(cls,v):
        if set(v)-set(FIELDS) or len(v)>7 or any(len(s)>4000 for s in v.values()):raise ValueError('Некорректные ответы')
        return v
class Offer(StrictModel):
    taskId:str=Field(max_length=80)
    idea:str=Field(min_length=10,max_length=3000)
    plan:str=Field(min_length=10,max_length=3000)
    prototype:str=Field(min_length=1,max_length=500)
    deadline:str=Field(min_length=2,max_length=100)
    @field_validator('prototype')
    @classmethod
    def url_check(cls,v):
        try:
            parsed=urlsplit(v)
            if parsed.scheme not in ('http','https') or not parsed.netloc or not parsed.hostname:raise ValueError
            parsed.port
        except ValueError:raise ValueError('Нужна корректная ссылка http/https')
        return v
class Decision(StrictModel):decision:Literal['accepted','rejected']
class Progress(StrictModel):evidence:str=Field(min_length=10,max_length=2000)

def task_public(r):
    t=json.loads(r['payload']);sc=score_task(t)
    return {**t,**sc,'id':r['id'],'owner':r['owner_id'],'version':r['version'],'createdAt':r['created'],'created':time.strftime('%d.%m.%Y',time.gmtime(r['created'])),'status':'published','tags':[t.get('industry','Другое')]}

def offer_public(r,c):
    ev=c.execute("SELECT evidence FROM ledger WHERE offer_id=? AND kind='progress'",(r['id'],)).fetchone()
    return {'id':r['id'],'taskId':r['task_id'],'teamId':r['team_id'],'idea':r['idea'],'plan':r['plan'],'prototype':r['prototype'],'deadline':r['deadline'],'status':r['status'],'created':time.strftime('%d.%m.%Y',time.gmtime(r['created'])),'progressConfirmed':bool(ev),'progressEvidence':ev['evidence'] if ev else ''}

@app.get('/api/health')
def health():
    with db() as c:c.execute('SELECT 1')
    return {'status':'ok','version':app.version,'aiConfigured':ai.configured()}
@app.post('/api/auth/register',status_code=201)
def register(payload:Register,request:Request,response:Response):
    rate_limit('register:'+request.client.host,10,3600)
    user_id=uid()
    try:
        with db() as c:c.execute('INSERT INTO users VALUES(?,?,?,?,?,?)',(user_id,payload.email,payload.name,payload.role,password_hash(payload.password),time.time()))
    except sqlite3.IntegrityError:raise HTTPException(409,'Этот email уже зарегистрирован.')
    csrf=session(response,user_id)
    return {'user':{'id':user_id,'email':payload.email,'name':payload.name,'role':payload.role},'csrfToken':csrf}
@app.post('/api/auth/login')
def login(payload:Login,request:Request,response:Response):
    rate_limit('login-ip:'+request.client.host,30,60)
    rate_limit('login-email:'+hashlib.sha256(payload.email.lower().encode()).hexdigest(),10,60)
    with db() as c:r=c.execute('SELECT * FROM users WHERE email=?',(payload.email.lower(),)).fetchone()
    dummy='0'*32+':'+'0'*64
    if not password_ok(payload.password,r['password'] if r else dummy) or not r:raise HTTPException(401,'Неверный email или пароль.')
    return {'user':user_dict(r),'csrfToken':session(response,r['id'])}
@app.get('/api/auth/me')
def me(user=Depends(current_user)):return {'user':user_dict(user),'csrfToken':user['csrf']}
@app.post('/api/auth/logout')
def logout(request:Request,response:Response,user=Depends(current_user)):
    with db() as c:c.execute('DELETE FROM sessions WHERE token_hash=?',(hashlib.sha256(request.cookies[COOKIE].encode()).hexdigest(),))
    response.delete_cookie(COOKIE,path='/');return {'ok':True}
@app.get('/api/state')
def state(user=Depends(current_user)):
    with db() as c:
        tasks=[task_public(r) for r in c.execute('SELECT * FROM tasks ORDER BY created DESC')]
        if user['role']=='business':offers=c.execute('SELECT o.* FROM offers o JOIN tasks t ON t.id=o.task_id WHERE t.owner_id=? ORDER BY o.created DESC',(user['id'],)).fetchall()
        else:offers=c.execute('SELECT * FROM offers WHERE team_id=? ORDER BY created DESC',(user['id'],)).fetchall()
        teams=[{'id':r['id'],'name':r['name'],'initials':''.join(w[0] for w in r['name'].split())[:2].upper(),'skills':[],'interests':[],'tech':'','points':r['points']} for r in c.execute("SELECT u.id,u.name,COALESCE(SUM(l.points),0) points FROM users u LEFT JOIN ledger l ON l.team_id=u.id WHERE u.role='team' GROUP BY u.id")]
        return {'tasks':tasks,'offers':[offer_public(r,c) for r in offers],'teams':teams,'user':user_dict(user),'aiConfigured':ai.configured()}
@app.post('/api/tasks/analyze')
async def analyze(payload:Analyze,user=Depends(current_user)):
    role(user,'business');rate_limit('ai:'+user['id'],20,3600)
    try:result=await ai.analyze(payload.raw,payload.answers,payload.local)
    except ai.AIUnavailable as e:raise HTTPException(503,str(e))
    return {**result,'assessment':score_task(result['card'])}
@app.post('/api/tasks/score')
def score(payload:dict[str,str],user=Depends(current_user)):
    if set(payload)-set(FIELDS) or any(len(x)>4000 for x in payload.values()):raise HTTPException(422,'Некорректные поля')
    return score_task(payload)
@app.post('/api/tasks',status_code=201)
def create_task(payload:Card,user=Depends(current_user)):
    role(user,'business')
    if not payload.confirmed:raise HTTPException(422,'Подтвердите карточку перед публикацией.')
    task_id=hashlib.sha256((user['id']+':'+payload.clientId).encode()).hexdigest()[:32]
    with db() as c:
        c.execute('BEGIN IMMEDIATE')
        existing=c.execute('SELECT * FROM tasks WHERE id=?',(task_id,)).fetchone()
        if existing:return task_public(existing)
        data=payload.model_dump(exclude={'clientId'})
        c.execute('INSERT INTO tasks VALUES(?,?,?,1,?)',(task_id,user['id'],json.dumps(data,ensure_ascii=False),time.time()))
        audit(c,user['id'],'task.published',task_id)
        return task_public(c.execute('SELECT * FROM tasks WHERE id=?',(task_id,)).fetchone())
@app.put('/api/tasks/{task_id}')
def update_task(task_id:str,payload:CardUpdate,user=Depends(current_user)):
    role(user,'business')
    if not payload.confirmed:raise HTTPException(422,'Подтвердите изменённую карточку.')
    with db() as c:
        c.execute('BEGIN IMMEDIATE');r=c.execute('SELECT * FROM tasks WHERE id=?',(task_id,)).fetchone()
        if not r:raise HTTPException(404,'Задача не найдена.')
        if r['owner_id']!=user['id']:raise HTTPException(403,'Редактировать может только владелец.')
        if r['version']!=payload.version:raise HTTPException(409,'Задача обновлена в другом окне. Откройте её заново.')
        c.execute('UPDATE tasks SET payload=?,version=version+1 WHERE id=?',(json.dumps(payload.model_dump(exclude={'clientId','version'}),ensure_ascii=False),task_id))
        audit(c,user['id'],'task.updated',task_id)
        return task_public(c.execute('SELECT * FROM tasks WHERE id=?',(task_id,)).fetchone())
@app.post('/api/offers',status_code=201)
def create_offer(payload:Offer,user=Depends(current_user)):
    role(user,'team')
    with db() as c:
        if not c.execute('SELECT id FROM tasks WHERE id=?',(payload.taskId,)).fetchone():raise HTTPException(404,'Задача не найдена.')
        offer_id=uid()
        try:c.execute('INSERT INTO offers VALUES(?,?,?,?,?,?,?,?,?)',(offer_id,payload.taskId,user['id'],payload.idea,payload.plan,payload.prototype,payload.deadline,'pending',time.time()))
        except sqlite3.IntegrityError:raise HTTPException(409,'Вы уже отправили предложение по этой задаче.')
        audit(c,user['id'],'offer.created',offer_id)
        return offer_public(c.execute('SELECT * FROM offers WHERE id=?',(offer_id,)).fetchone(),c)

def owned_offer(c,offer_id,user):
    role(user,'business')
    r=c.execute('SELECT o.*,t.owner_id FROM offers o JOIN tasks t ON t.id=o.task_id WHERE o.id=?',(offer_id,)).fetchone()
    if not r:raise HTTPException(404,'Отклик не найден.')
    if r['owner_id']!=user['id']:raise HTTPException(403,'Решение может принять только владелец задачи.')
    return r
@app.post('/api/offers/{offer_id}/decision')
def decision(offer_id:str,payload:Decision,user=Depends(current_user)):
    with db() as c:
        c.execute('BEGIN IMMEDIATE');r=owned_offer(c,offer_id,user)
        if r['status']==payload.decision:return offer_public(r,c)
        if r['status']!='pending':raise HTTPException(409,'Решение уже принято. Статус нельзя изменить повторно.')
        c.execute('UPDATE offers SET status=? WHERE id=?',(payload.decision,offer_id))
        if payload.decision=='accepted':c.execute('INSERT OR IGNORE INTO ledger VALUES(?,?,?,?,?,?)',(offer_id,'start',r['team_id'],5,'Команда выбрана бизнесом',time.time()))
        audit(c,user['id'],'offer.'+payload.decision,offer_id)
        return offer_public(c.execute('SELECT * FROM offers WHERE id=?',(offer_id,)).fetchone(),c)
@app.post('/api/offers/{offer_id}/progress')
def progress(offer_id:str,payload:Progress,user=Depends(current_user)):
    with db() as c:
        c.execute('BEGIN IMMEDIATE');r=owned_offer(c,offer_id,user)
        if r['status']!='accepted':raise HTTPException(409,'Сначала выберите команду.')
        cursor=c.execute('INSERT OR IGNORE INTO ledger VALUES(?,?,?,?,?,?)',(offer_id,'progress',r['team_id'],10,payload.evidence,time.time()))
        if cursor.rowcount:audit(c,user['id'],'progress.confirmed',offer_id)
        return offer_public(r,c)
@app.get('/api/export')
def export(user=Depends(current_user)):return state(user)

# Serve only the frontend allowlist; never .env, SQLite, source, or tests.
@app.get('/')
def index():return FileResponse(ROOT/'public/index.html')
@app.get('/{asset}')
def asset(asset:str):
    if asset not in {'app.js','styles.css','rubric.json','demo.html'}:raise HTTPException(404)
    return FileResponse(ROOT/'public'/asset)
