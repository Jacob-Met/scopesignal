import os; from pathlib import Path
for key in list(os.environ):
 if key.lower()=='npm_config_cache': del os.environ[key]
os.environ['npm_config_cache']=str(Path('docs/receiving/workspace-review-cli-69570d292200/npm-cache').resolve())
os.execvp('npm',['npm','run','--silent','test'])
