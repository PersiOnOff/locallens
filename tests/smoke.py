"""Black-box API contract tests. Only the external Ollama protocol is simulated.
Runs the real ASP.NET app and SQLite. No model downloads required.
"""
import contextlib, http.server, json, os, pathlib, socket, subprocess, tempfile, threading, time, urllib.request, urllib.error

ROOT = pathlib.Path(__file__).resolve().parents[1]
def port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]

class Ollama(http.server.BaseHTTPRequestHandler):
    fail = False
    def log_message(self, *args): pass
    def do_GET(self):
        self.send_response(200); self.send_header('Content-Type','application/json'); self.end_headers()
        self.wfile.write(json.dumps({'models':[{'name':'fixture-chat:latest'},{'name':'fixture-embed:latest'}]}).encode())
    def do_POST(self):
        payload = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        if type(self).fail:
            self.send_response(503); self.end_headers(); self.wfile.write(b'{"error":"fixture offline"}'); return
        self.send_response(200)
        self.send_header('Content-Type','application/x-ndjson' if self.path == '/api/chat' else 'application/json'); self.end_headers()
        if self.path == '/api/embed':
            values = payload.get('input',[])
            if isinstance(values,str): values = [values]
            self.wfile.write(json.dumps({'model':payload['model'],'embeddings':[[1.0,0.1] for _ in values],'total_duration':1,'load_duration':1,'prompt_eval_count':10}).encode())
        elif self.path == '/api/chat':
            for content,done in [('Refunds are available ',False),('within 30 days [1].',False),('',True)]:
                self.wfile.write((json.dumps({'model':payload['model'],'created_at':'2026-11-10T00:00:00Z','message':{'role':'assistant','content':content},'done':done,'done_reason':'stop' if done else None})+'\n').encode()); self.wfile.flush()
        else:
            raise AssertionError('Unexpected Ollama endpoint: '+self.path)

def pdf_fixture(pages):
    objects=[b'<< /Type /Catalog /Pages 2 0 R >>',None,b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
    page_ids=[]
    for text in pages:
        page_id=len(objects)+1; page_ids.append(page_id)
        stream=('BT /F1 12 Tf 72 720 Td ('+text+') Tj ET').encode('ascii')
        objects.append(f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents {page_id+1} 0 R >>'.encode())
        objects.append(f'<< /Length {len(stream)} >>\nstream\n'.encode()+stream+b'\nendstream')
    objects[1]=('<< /Type /Pages /Kids ['+' '.join(f'{i} 0 R' for i in page_ids)+f'] /Count {len(pages)} >>').encode()
    result=b'%PDF-1.4\n'; offsets=[0]
    for i,obj in enumerate(objects,1):
        offsets.append(len(result));result+=f'{i} 0 obj\n'.encode()+obj+b'\nendobj\n'
    xref=len(result);result+=f'xref\n0 {len(offsets)}\n0000000000 65535 f \n'.encode()
    result+=b''.join(f'{o:010d} 00000 n \n'.encode() for o in offsets[1:])
    return result+f'trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF'.encode()

def run():
    api_port, ollama_port = port(),port()
    server = http.server.ThreadingHTTPServer(('127.0.0.1',ollama_port),Ollama)
    threading.Thread(target=server.serve_forever,daemon=True).start()
    artifacts = ROOT / 'tests' / '.artifacts'; artifacts.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=artifacts) as directory:
        repo = pathlib.Path(directory)/'repos'; repo.mkdir()
        (repo/'guide.md').write_text('See [Policy](policy.md).\n',encoding='utf-8')
        (repo/'policy.md').write_text('Refunds are available within 30 days.\n',encoding='utf-8')
        (repo/'.env').write_text('PRIVATE=do-not-index',encoding='utf-8')
        env = dict(os.environ, ASPNETCORE_URLS=f'http://127.0.0.1:{api_port}', Lens__DataDirectory=directory+'/data', Lens__RepositoryRoot=str(repo), Lens__OllamaUrl=f'http://127.0.0.1:{ollama_port}', Lens__ChatModel='fixture-chat', Lens__EmbeddingModel='fixture-embed')
        log = open(pathlib.Path(directory)/'api.log','w',encoding='utf-8')
        process = subprocess.Popen(['dotnet',str(ROOT/'src/SelfHostedAi.Api/bin/Debug/net10.0/SelfHostedAi.Api.dll')],cwd=ROOT,env=env,stdout=log,stderr=log)
        base = f'http://127.0.0.1:{api_port}'
        def request(path,data=None,method=None,content_type='application/json'):
            if isinstance(data,dict): data=json.dumps(data).encode()
            req=urllib.request.Request(base+path,data=data,method=method,headers={'Content-Type':content_type})
            try:
                with urllib.request.urlopen(req,timeout=30) as r: return r.status,r.read().decode()
            except urllib.error.HTTPError as e: return e.code,e.read().decode()
        def upload(name,content):
            boundary='LocalLensTestBoundary'
            body=f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode()+content+f'\r\n--{boundary}--\r\n'.encode()
            return request('/api/documents',body,'POST','multipart/form-data; boundary='+boundary)
        def wait_doc(doc_id,status='ready'):
            for _ in range(150):
                code,body=request('/api/documents/'+doc_id)
                doc=json.loads(body)
                if doc.get('status')==status: return doc
                if doc.get('status')=='failed' and status!='failed': raise AssertionError(doc)
                time.sleep(.1)
            raise AssertionError('Indexing did not finish')
        try:
            for _ in range(150):
                try:
                    if request('/api/health')[0]==200: break
                except (OSError,urllib.error.URLError): pass
                if process.poll() is not None: raise AssertionError('API exited')
                time.sleep(.1)
            assert upload('malware.exe',b'not a document')[0]==400, 'unsupported uploads must be rejected'
            assert upload('empty.txt',b' \n ')[0]==400, 'blank documents must be rejected'
            assert upload('binary.txt',b'hello\x00world')[0]==400, 'binary files must be rejected'
            assert upload('invalid.txt',b'\xff\xfe')[0]==400, 'invalid UTF-8 must be rejected'
            assert upload('scanned.pdf',pdf_fixture(['']))[0]==400, 'PDF without text requires OCR'
            foreign=urllib.request.Request(base+'/api/repositories',data=b'{"path":"."}',headers={'Content-Type':'application/json','Origin':'https://untrusted.example'})
            try: urllib.request.urlopen(foreign); raise AssertionError('foreign origin accepted')
            except urllib.error.HTTPError as e: assert e.code==403
            code,body=upload('two-pages.pdf',pdf_fixture(['First page about local storage.','Second page about privacy.']))
            assert code==202,(code,body)
            pdf_id=json.loads(body)['id']; pdf_doc=wait_doc(pdf_id)
            assert len(json.loads(pdf_doc['pagesJson']))==2
            code,stream=request('/api/chat',{'question':'What is on the second page?','documentIds':[pdf_id]})
            pdf_sources=next(json.loads(line[6:]) for line in stream.splitlines() if line.startswith('data: [') )
            assert {s['page'] for s in pdf_sources}=={1,2},pdf_sources
            code,body=upload('refund-policy.md',b'# Refund policy\nRefunds are available within 30 days.\n')
            assert code==202,(code,body)
            doc_id=json.loads(body)['id']; doc=wait_doc(doc_id)
            assert doc['chunkCount']>0 and doc['progress']==100
            assert request('/api/documents/'+doc_id)[0]==200
            code,stream=request('/api/chat',{'question':'What is the refund window?','documentIds':[doc_id],'history':[]})
            assert code==200 and 'event: sources' in stream and '30 days' in stream and 'event: done' in stream,stream
            events=[json.loads(line[6:]) for line in stream.splitlines() if line.startswith('data: ')]
            evidence=next(e for e in events if isinstance(e,list))
            assert evidence[0]['documentId']==doc_id and '30 days' in evidence[0]['text']
            assert request('/api/chat',{'question':'','history':[]})[0]==400
            code,body=request('/api/repositories',{'path':'../escape'})
            assert code==400,(code,body)
            code,body=request('/api/repositories',{'path':'.'})
            assert code==202,(code,body)
            for _ in range(100):
                docs=json.loads(request('/api/documents')[1])
                if all(d['status'] in ('ready','failed') for d in docs): break
                time.sleep(.1)
            assert len(docs)==4 and not any(d['name']=='.env' for d in docs),docs
            graph=json.loads(request('/api/graph')[1]); assert len(graph['edges'])>=1,graph
            Ollama.fail=True
            code,stream=request('/api/chat',{'question':'refunds','documentIds':[doc_id]})
            assert 'event: error' in stream and 'event: done' not in stream,stream
            code,body=upload('offline.txt',b'Embedding must report a failure.')
            assert code==202; failed_id=json.loads(body)['id']
            assert wait_doc(failed_id,'failed')['error']
            Ollama.fail=False
            assert request('/api/documents/'+failed_id+'/retry',b'','POST')[0]==202
            wait_doc(failed_id)
            assert request('/api/documents/'+doc_id,None,'DELETE')[0]==204
            assert request('/api/documents/'+doc_id)[0]==404
            print('PASS API: upload, validation, indexing, citations, streaming, repository graph, provider failure, retry, delete')
        except Exception:
            log.flush(); print((pathlib.Path(directory)/'api.log').read_text(encoding='utf-8')[-12000:]); raise
        finally:
            process.terminate()
            try: process.wait(timeout=10)
            except subprocess.TimeoutExpired: process.kill(); process.wait()
            log.close(); server.shutdown()
if __name__=='__main__': run()
