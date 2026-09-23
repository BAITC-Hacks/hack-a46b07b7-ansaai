"""Ten development cases. --live requires a server-side key and makes paid API calls."""
import argparse,asyncio,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from backend.ai import analyze,configured
p=argparse.ArgumentParser();p.add_argument('--live',action='store_true');args=p.parse_args()
if args.live and not configured():raise SystemExit('Live evaluation not run: configure TASKREADY_AI_API_KEY first.')
async def run():
    results=[]
    for case in json.loads((ROOT/'tests/ai_cases.json').read_text()):
        try:
            r=await analyze(case['raw'],{},use_local=not args.live)
            assert len(r['questions'])>=3
            assert len({q['field'] for q in r['questions']})==len(r['questions'])
            assert r['mode']==('llm' if args.live else 'local')
            results.append({'case':case['name'],'status':'pass','mode':r['mode'],'questions':len(r['questions'])})
        except Exception as e:results.append({'case':case['name'],'status':'fail','error':str(e)})
    print(json.dumps({'live':args.live,'results':results,'note':'Это проверка структуры и источников, не оценка качества вопросов экспертами.'},ensure_ascii=False,indent=2))
    if any(r['status']=='fail' for r in results):raise SystemExit(1)
asyncio.run(run())
