"""Prints `export KEY='value'` lines for a .env file, so bash can load it without running it as shell code
(values such as  EMAIL_FROM=ILLUSZIONZ MEDIA <mail@…>  break a plain `source`). Never prints anything else."""
import re, shlex, sys

for line in open(sys.argv[1], encoding='utf-8'):
    if line.lstrip().startswith('#'):
        continue
    m = re.match(r'\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$', line)
    if not m:
        continue
    v = m.group(2)
    if len(v) >= 2 and v[0] == v[-1] and v[0] in '"\'':
        v = v[1:-1]
    print(f'export {m.group(1)}={shlex.quote(v)}')
