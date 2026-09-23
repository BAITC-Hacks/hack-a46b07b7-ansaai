import asyncio, json
from concurrent.futures import ThreadPoolExecutor
import pytest
from fastapi.testclient import TestClient
from backend import main, ai
from backend.scoring import score_task

@pytest.fixture(autouse=True)
def database(tmp_path,monkeypatch):
    monkeypatch.setattr(main,'DB_PATH',tmp_path/'test.sqlite3')
    monkeypatch.setenv('TASKREADY_AI_PROVIDER','openai')
    monkeypatch.delenv('TASKREADY_AI_API_KEY',raising=False);monkeypatch.delenv('OPENAI_API_KEY',raising=False)

def account(email,role='business'):
    c=TestClient(main.app);r=c.post('/api/auth/register',json={'email':email,'password':'TestPassword123!','name':'Тестовая команда' if role=='team' else 'Тестовый бизнес','role':role})
    assert r.status_code==201,r.text
    c.headers['X-CSRF-Token']=r.json()['csrfToken'];return c,r.json()['user']

def card(**kw):
    return {'title':'Импорт входящих заявок','context':'Менеджеры вручную переносят заявки и теряют 4 часа каждую неделю.',
    'data':'Доступна CSV выгрузка: 150 заявок и 20 обезличенных примеров.',
    'expected':'Прототип импорта заявок в единый реестр.',
    'success':'Не менее 80% заявок без ручного копирования.',
    'constraints':'MVP за 2 недели, без доступа к продакшену.',
    'users':'Менеджеры отдела продаж работают с заявками ежедневно.',
    'business':'Ответственный — руководитель отдела, еженедельный созвон.',
    'confirmed':True,'clientId':'client-test-0001',**kw}

def create(c):
    r=c.post('/api/tasks',json=card());assert r.status_code==201,r.text;return r.json()

def offer(c,t):
    r=c.post('/api/offers',json={'taskId':t['id'],'idea':'Прототип импорта заявок из CSV','plan':'Сначала импорт, затем проверка на 20 примерах','deadline':'10 дней','prototype':'https://example.com/prototype'})
    assert r.status_code==201,r.text;return r.json()

def test_accounts_auth_csrf_and_logout():
    c,u=account('owner@example.com')
    assert c.get('/api/auth/me').json()['user']['id']==u['id']
    assert c.get('/api/state').json()['tasks']==[]
    csrf=c.headers.pop('X-CSRF-Token')
    assert c.post('/api/tasks',json=card()).status_code==403
    c.headers['X-CSRF-Token']=csrf
    assert c.post('/api/tasks',json=card(),headers={'Origin':'https://attacker.example'}).status_code==403
    assert c.post('/api/auth/logout',json={}).status_code==200
    assert c.get('/api/state').status_code==401
    assert c.post('/api/auth/login',json={'email':'owner@example.com','password':'incorrect-password'}).status_code==401
    r=c.post('/api/auth/login',json={'email':'owner@example.com','password':'TestPassword123!'})
    assert r.status_code==200 and 'HttpOnly' in r.headers['set-cookie']

def test_roles_ownership_privacy_idempotence_conflicts():
    b,u=account('business@example.com');other,_=account('other@example.com');team,tu=account('team@example.com','team');team2,_=account('team2@example.com','team')
    assert b.post('/api/tasks',json=card(confirmed=False)).status_code==422
    assert team.post('/api/tasks',json=card()).status_code==403
    t=create(b);assert create(b)['id']==t['id'];assert len(b.get('/api/state').json()['tasks'])==1
    assert other.put('/api/tasks/'+t['id'],json={**card(),'version':1}).status_code==403
    assert b.put('/api/tasks/'+t['id'],json={**card(),'version':1}).status_code==200
    assert b.put('/api/tasks/'+t['id'],json={**card(),'version':1}).status_code==409
    o=offer(team,t)
    assert team2.get('/api/state').json()['offers']==[]
    assert other.get('/api/state').json()['offers']==[]
    assert team.post('/api/offers',json={'taskId':t['id'],'idea':'Ещё одна идея решения','plan':'Тестовый план разработки','deadline':'7 дней'}).status_code==409
    path='/api/offers/'+o['id']
    assert other.post(path+'/decision',json={'decision':'accepted'}).status_code==403
    assert team.post(path+'/progress',json={'evidence':'Проверили импорт на 20 строках'}).status_code==403
    assert b.post(path+'/progress',json={'evidence':'Проверили импорт на 20 строках'}).status_code==409
    for _ in range(2):assert b.post(path+'/decision',json={'decision':'accepted'}).status_code==200
    assert b.post(path+'/decision',json={'decision':'rejected'}).status_code==409
    for _ in range(2):assert b.post(path+'/progress',json={'evidence':'Проверили импорт на 20 строках'}).status_code==200
    state=team.get('/api/state').json();assert next(t for t in state['teams'] if t['id']==tu['id'])['points']==15
    assert state['offers'][0]['progressConfirmed'] is True
    # Another client keeps all independent writes; no global PUT state.
    assert b.put('/api/state',json={}).status_code in (404,405)

def test_concurrent_progress_exactly_once():
    b,_=account('business@example.com');team,u=account('team@example.com','team');o=offer(team,create(b))
    path='/api/offers/'+o['id'];b.post(path+'/decision',json={'decision':'accepted'})
    def confirm(_):return b.post(path+'/progress',json={'evidence':'Проверили результат на тестовых данных'}).status_code
    with ThreadPoolExecutor(max_workers=4) as pool:assert list(pool.map(confirm,range(8)))==[200]*8
    assert next(t for t in team.get('/api/state').json()['teams'] if t['id']==u['id'])['points']==15

def test_safe_static_and_bad_input():
    c,_=account('a@example.com')
    for path in ['/.env','/data/taskready-v3.sqlite3','/backend/main.py','/README.md','/public/../backend/main.py']:
        assert c.get(path).status_code==404
    team,_=account('team@example.com','team');t=create(c)
    assert team.post('/api/offers',json={'taskId':t['id'],'idea':'Идея достаточно длинная','plan':'План достаточно длинный','deadline':'10 дней','prototype':'javascript:alert(1)'}).status_code==422
    assert c.post('/api/tasks',json={**card(),'owner':'attacker'}).status_code==422

def test_content_rubric():
    good=score_task(card());bad=score_task({k:'Нужно хорошее современное удобное решение. '*40 for k in main.FIELDS})
    assert good['score']>=90;assert bad['score']<25
    assert score_task({'success':'Не определены.'})['score']==0
    assert score_task({'data':'данные '*100})['score']==0
    assert all('reason' in r for r in good['breakdown'])

def test_local_analysis_and_missing_key():
    c,_=account('a@example.com')
    payload={'raw':'Менеджеры вручную переносят заявки в таблицу.','answers':{}}
    assert c.post('/api/tasks/analyze',json=payload).status_code==503
    r=c.post('/api/tasks/analyze',json={**payload,'local':True})
    assert r.status_code==200 and r.json()['mode']=='local' and len(r.json()['questions'])>=3
    assert r.json()['card']['data']==''

def test_llm_grounding_rejects_invented_fact():
    result=ai.Extraction(evidence=[{'field':'constraints','quote':'Срок — 2 недели.'}],questions=[{'field':k,'question':q} for k,q in list(ai.QUESTIONS.items())[:3]])
    with pytest.raises(ai.AIUnavailable):ai.grounded_card(result,'Нужен каталог заявок.',{})

def test_llm_adapter_contract(monkeypatch):
    monkeypatch.setenv('TASKREADY_AI_API_KEY','test-key-not-real')
    raw='Менеджеры вручную переносят заявки.'
    result={'evidence':[{'field':'context','quote':raw}], 'questions':[{'field':k,'question':ai.QUESTIONS[k]} for k in ['data','success','constraints']]}
    class MockResponse:
        def raise_for_status(self):pass
        def json(self):return {'status':'completed','output':[{'type':'message','content':[{'type':'output_text','text':json.dumps(result)}]}]}
    class MockClient:
        def __init__(self,**kw):pass
        async def __aenter__(self):return self
        async def __aexit__(self,*a):pass
        async def post(self,url,**kw):
            assert url=='https://api.openai.com/v1/responses';assert kw['json']['store'] is False
            assert kw['json']['text']['format']['strict'] is True
            return MockResponse()
    monkeypatch.setattr(ai.httpx,'AsyncClient',MockClient)
    output=asyncio.run(ai.analyze(raw,{}));assert output['mode']=='llm';assert output['card']['context']==raw
    assert output['card']['constraints']==''

def test_llm_provider_error_never_silent_fallback(monkeypatch):
    monkeypatch.setenv('TASKREADY_AI_API_KEY','test-key-not-real')
    async def fail(*a,**kw):raise ai.AIUnavailable('AI временно недоступен')
    monkeypatch.setattr(ai,'analyze',fail)
    c,_=account('owner@example.com')
    r=c.post('/api/tasks/analyze',json={'raw':'Менеджеры теряют заявки при ручном копировании.'})
    assert r.status_code==503 and 'mode' not in r.json()

def test_fresh_client_reads_persisted_data():
    c,u=account('owner@example.com');t=create(c)
    fresh=TestClient(main.app)
    r=fresh.post('/api/auth/login',json={'email':'owner@example.com','password':'TestPassword123!'})
    assert r.status_code==200
    assert fresh.get('/api/state').json()['tasks'][0]['id']==t['id']
