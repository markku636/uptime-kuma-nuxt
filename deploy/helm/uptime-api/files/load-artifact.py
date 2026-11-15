import os,sys,hashlib,urllib.request,tarfile,pathlib,posixpath,shutil,time,json,uuid
root=pathlib.Path('/artifacts');sha=os.environ['ARTIFACT_SHA'];size=int(os.environ['ARTIFACT_BYTES']);url=os.environ['ARTIFACT_URL']
if len(sha)!=64 or any(c not in '0123456789abcdef' for c in sha) or size<=0 or size>2*1024**3:raise ValueError('Invalid artifact identity')
release=root/'releases'/sha
if release.exists():
 if json.loads((release/'.complete').read_text())['sha256']!=sha:raise ValueError('Incomplete existing release')
 print('Release already complete');sys.exit(0)
staging=root/'.staging'/(sha+'-'+str(uuid.uuid4()));staging.mkdir(parents=True);archive=staging/'bundle.tgz';unpacked=staging/'release';unpacked.mkdir();started=time.monotonic()
try:
 digest=hashlib.sha256();received=0
 with urllib.request.urlopen(url,timeout=10) as response,archive.open('wb') as output:
  while True:
   if time.monotonic()-started>240:raise TimeoutError('Artifact transfer deadline')
   chunk=response.read(1024*1024)
   if not chunk:break
   received+=len(chunk)
   if received>size:raise ValueError('Artifact size exceeded')
   digest.update(chunk);output.write(chunk)
 if received!=size or digest.hexdigest()!=sha:raise ValueError('Artifact integrity mismatch')
 with tarfile.open(archive,'r:gz') as bundle:
  for member in bundle:
   name=member.name
   if name.startswith('/') or '..' in pathlib.PurePosixPath(name).parts or member.isdev() or member.isfifo():raise ValueError('Unsafe archive entry')
   if member.issym() or member.islnk():
    target=posixpath.normpath(posixpath.join(posixpath.dirname(name) if member.issym() else '',member.linkname))
    if member.linkname.startswith('/') or target=='..' or target.startswith('../'):raise ValueError('Unsafe archive link')
  bundle.extractall(unpacked,filter='data')
 for name in ['.output/server/index.mjs','scripts/migrate.mjs','prisma/schema.prisma','node_modules/prisma/build/index.js']:
  if not (unpacked/name).is_file():raise ValueError('Missing runtime dependency')
 (unpacked/'.complete').write_text(json.dumps({'sha256':sha,'bytes':size}))
 release.parent.mkdir(parents=True,exist_ok=True);unpacked.rename(release)
 print('Verified immutable artifact installed')
finally:shutil.rmtree(staging,ignore_errors=True)
