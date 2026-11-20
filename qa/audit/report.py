import json,sys
d=json.load(open(sys.argv[1])); P=d['pages']; base=sys.argv[2]
print("sider:",len(P))
for u,r in sorted(P.items()):
    m=r.get('mob',{}); k=r.get('desk',{}); issues=[]
    if r.get('mob_err') or r.get('desk_err'): issues.append(('ERR',r.get('mob_err'),r.get('desk_err')))
    if r.get('mob_status') and r['mob_status']>=400: issues.append(('status',r['mob_status']))
    if r.get('mob_final') and r['mob_final'].rstrip('/')!=u.rstrip('/'): issues.append(('→',r['mob_final'].replace(base,'')))
    if m.get('overflow'): issues.append(('mobil-rul',m.get('wide')))
    if k.get('overflow'): issues.append(('desk-rul',k.get('wide')))
    if m.get('imgs'): issues.append(('døde billeder',m['imgs'][:3]))
    if len(m.get('h1',[]))!=1: issues.append(('h1',m.get('h1')))
    if m.get('empties'): issues.append(('tomme knapper',m['empties']))
    cons=sorted(set(c for c in r['console'] if 'realtime' not in c.lower() and 'websocket' not in c.lower() and 'ERR_CONNECTION' not in c)); bad=sorted(set(b for b in r['bad'] if 'realtime' not in b))
    if cons: issues.append(('konsol',cons[:5]))
    if bad: issues.append(('fejlkald',bad[:5]))
    if issues:
        print(u.replace(base,'') or '/','|',m.get('title','')[:50])
        for i in issues: print('     !!',str(i)[:500])
