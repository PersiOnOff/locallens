"""Optional end-to-end check against the running Docker stack and real local models.
Uses fictional samples only. Leaves them in the library for manual exploration.
"""
import json, pathlib, time, urllib.request
BASE='http://localhost:8080'
def request(path,data=None,method=None,content_type='application/json'):
    if isinstance(data,dict): data=json.dumps(data).encode()
    with urllib.request.urlopen(urllib.request.Request(BASE+path,data=data,method=method,headers={'Content-Type':content_type}),timeout=310) as response:
        return response.read().decode()
health=json.loads(request('/api/health'))
assert health['ollama']['ready'],health
sample=pathlib.Path(__file__).resolve().parents[1]/'samples'/'policy.md'
boundary='LocalLensRealTest'
body=f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="policy.md"\r\nContent-Type: text/markdown\r\n\r\n'.encode()+sample.read_bytes()+f'\r\n--{boundary}--\r\n'.encode()
doc=json.loads(request('/api/documents',body,'POST','multipart/form-data; boundary='+boundary));print('Uploaded:',doc['id'],flush=True)
for _ in range(300):
    status=json.loads(request('/api/documents/'+doc['id']))
    if status['status']=='ready': break
    if status['status']=='failed': raise AssertionError(status['error'])
    time.sleep(1)
else: raise AssertionError('Indexing timeout')
print('Indexed:',status['chunkCount'],'passages',flush=True)
start=time.monotonic()
stream=request('/api/chat',{'question':'How many days after purchase can a standard customer request a refund? Answer in one sentence and cite the source.','documentIds':[doc['id']],'history':[]})
events=[]; event=''
for line in stream.splitlines():
    if line.startswith('event: '): event=line[7:]
    if line.startswith('data: '): events.append((event,json.loads(line[6:])))
assert not any(event=='error' for event,_ in events),events
assert any(event=='done' for event,_ in events),events
sources=next(data for event,data in events if event=='sources')
assert sources and all(s['documentId']==doc['id'] for s in sources),sources
answer=''.join(data['text'] for event,data in events if event=='token')
assert '30' in answer and '[1]' in answer,answer
print('Real answer:',answer,flush=True)
print(f'PASS real Ollama upload -> embeddings -> SQLite -> retrieval -> streaming answer -> citation ({time.monotonic()-start:.1f}s)',flush=True)
