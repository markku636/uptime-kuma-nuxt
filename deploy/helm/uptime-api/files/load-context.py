import os,hashlib,urllib.request,tarfile,pathlib,posixpath,time
sha=os.environ['CONTEXT_SHA'];size=int(os.environ['CONTEXT_BYTES']);archive=pathlib.Path('/workspace/context.tgz');digest=hashlib.sha256();received=0;started=time.monotonic()
if len(sha)!=64 or any(c not in '0123456789abcdef' for c in sha) or not 0<size<100*1024**2:raise ValueError('Invalid context identity')
with urllib.request.urlopen(os.environ['CONTEXT_URL'],timeout=10) as response,archive.open('wb') as output:
 while True:
  if time.monotonic()-started>240:raise TimeoutError('Context transfer timeout')
  block=response.read(1024*1024)
  if not block:break
  received+=len(block)
  if received>size:raise ValueError('Context size exceeded')
  digest.update(block);output.write(block)
if received!=size or digest.hexdigest()!=sha:raise ValueError('Context integrity mismatch')
with tarfile.open(archive,'r:gz') as bundle:
 for member in bundle:
  parts=pathlib.PurePosixPath(member.name).parts
  if member.name.startswith('/') or '..' in parts or member.isdev() or member.isfifo() or member.issym() or member.islnk():raise ValueError('Unsafe source context')
  if any(part.startswith('.env') or part in ['.git','.data','node_modules','.output','.nuxt'] for part in parts):raise ValueError('Forbidden source context')
 bundle.extractall('/workspace',filter='data')
archive.unlink();print('Source context verified')
