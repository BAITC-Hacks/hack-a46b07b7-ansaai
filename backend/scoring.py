"""Deterministic, evidence-oriented rubric. It checks specificity, not factual truth."""
import json
import re
from pathlib import Path
RUBRIC = json.loads((Path(__file__).resolve().parents[1]/'public/rubric.json').read_text())
FIELDS = RUBRIC['fields']
PLACEHOLDER = re.compile(r'^(не знаю|не определен[ыоа]?|уточняется|пока неизвестно|нет|потом|tbd|n/?a)[.!\s]*$', re.I)

def level_for(score):
    return 'Приоритетная' if score>=90 else 'Готовая' if score>=70 else 'Рабочая' if score>=40 else 'Черновик'

def score_task(card):
    rows=[]
    for field,spec in FIELDS.items():
        text=str(card.get(field) or '').strip()
        words=re.findall(r'[\w]+',text.lower())
        useful=len(set(words))>=3 and not PLACEHOLDER.fullmatch(text)
        checks=[{'label':c['label'],'passed':bool(useful and re.search(c['pattern'],text,re.I))} for c in spec['checks']]
        points=int(spec['weight']*sum(c['passed'] for c in checks)/len(checks)+.5)
        rows.append({'key':field,'label':spec['label'],'weight':spec['weight'],'points':points,'checks':checks,
                     'reason':'; '.join(c['label'] for c in checks if not c['passed']) or 'Оба признака конкретности найдены'})
    total=sum(r['points'] for r in rows)
    return {'score':total,'level':level_for(total),'breakdown':rows,'rubricVersion':RUBRIC['version'],
            'note':'Оценка конкретности по прозрачным правилам, не гарантия достоверности или реализуемости.'}
