"""Verify canonical task rows, ready gates and the dependency graph without mutating docs."""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parent.parent/'docs/internal-tools-overhaul'
meta={}
for path in (ROOT/'tasks').glob('*.md'):
    fields=dict(re.findall(r'^([\w_]+):\s*(.*)$',path.read_text().split('---',2)[1],re.M))
    assert fields['id']==path.stem, path
    meta[path.stem]=fields

def deps(task,key):
    return [value.strip() for value in meta[task][key].strip('[]').split(',') if value.strip()]

rows=0
for line in (ROOT/'tracker.md').read_text().splitlines():
    match=re.match(r'^\| ([A-Z]+-\d+(?:-[A-Z]+)?) \|',line)
    if not match: continue
    cells=[cell.strip() for cell in line.strip('|').split('|')]
    task=match[1];m=meta[task]
    assert cells[1]==m['title'].strip('"'), task
    assert cells[2]==m['priority'] and cells[3]==f"`{m['delivery_class']}`", task
    for index,key in [(4,'implementation_dependencies'),(5,'activation_dependencies')]:
        assert cells[index]==(', '.join(deps(task,key)) or '—'), task
    assert cells[6]==m['status'] and cells[7]==m['owner'], task
    short={'pending':'P','done':'D','not_applicable':'NA'}
    assert cells[8]=='/'.join(short[m[key]] for key in ['implementation','local_verification','external_activation','live_verification']), task
    rows+=1
for task,m in meta.items():
    for dep in deps(task,'implementation_dependencies')+deps(task,'activation_dependencies'): assert dep in meta,(task,dep)
    if m['status']=='ready' and m['delivery_class'] in ('CODE_ONLY','CODE_AND_EXTERNAL'):
        assert all(meta[d]['implementation']=='done' and meta[d]['local_verification']=='done' and (meta[d]['delivery_class']!='DECISION' or meta[d]['status']=='complete') for d in deps(task,'implementation_dependencies')),task
visited=set()
def visit(task,path):
    assert task not in path, 'Cycle: '+' -> '.join([*path,task])
    if task in visited:return
    for dep in deps(task,'implementation_dependencies')+deps(task,'activation_dependencies'):visit(dep,[*path,task])
    visited.add(task)
for task in meta:visit(task,[])
print(f'PASS: {len(meta)} canonical briefs, {rows} matching tracker rows, ready gates and acyclic dependencies')
