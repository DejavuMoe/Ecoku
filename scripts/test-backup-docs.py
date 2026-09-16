#!/usr/bin/env python3
"""Exercise documented backup/upgrade shells in disposable directories.

Docker/sudo/editor are stubbed; tar and filesystem modes are real. This does
not validate root escalation or UID 10001 ownership on a production host.
"""
import os
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
for locale in ('', 'en', 'zh-hant', 'ja'):
    for page in ('backup', 'upgrade'):
        text = (ROOT / 'docs' / locale / 'self-hosting' / f'{page}.md').read_text()
        blocks = re.findall(r'```bash\n(.*?)\n```', text, re.S)
        for block in blocks:
            subprocess.run(['bash', '-n'], input=block, text=True, check=True)
        for fail_tar in (False, True):
            with tempfile.TemporaryDirectory(prefix='ecoku-backup-docs-') as tmp:
                base = Path(tmp)
                work = base / 'Ecoku'
                (work / 'data').mkdir(parents=True, mode=0o750)
                (work / 'app').mkdir()
                for name in ('data/ecoku.sqlite3', 'data/ecoku.sqlite3-wal',
                             'app/config.yaml', 'ecoku.env', 'compose.yaml'):
                    (work / name).write_text('isolated fixture\n')
                (work / 'app/config.yaml').chmod(0o640)
                bin_dir = base / 'bin'
                bin_dir.mkdir()
                sudo = bin_dir / 'sudo'
                sudo.write_text('''#!/bin/sh
case "$1" in
  docker) printf '%s\\n' "$*" >> "$AUDIT_COMMAND_LOG" ;;
  tar) [ "$AUDIT_FAIL_TAR" = 0 ] || exit 2; exec "$@" ;;
  *) exit 99 ;;
esac
''')
                sudo.chmod(0o700)
                for name in ('vi', 'curl'):
                    stub = bin_dir / name
                    stub.write_text('#!/bin/sh\nexit 0\n')
                    stub.chmod(0o700)
                env = dict(os.environ, AUDIT_HOME=tmp, PATH=f'{bin_dir}:{os.environ["PATH"]}',
                           AUDIT_COMMAND_LOG=str(base / 'commands'),
                           AUDIT_FAIL_TAR=str(int(fail_tar)))
                result = subprocess.run(['bash'], input=blocks[0].replace('$HOME', '$AUDIT_HOME'), text=True, env=env,
                                        capture_output=True)
                calls = (base / 'commands').read_text()
                assert (result.returncode != 0) == fail_tar, (locale, page, result.stderr)
                assert ('compose up -d' in calls) == (not fail_tar), calls
                if fail_tar:
                    assert 'compose pull' not in calls, calls
                else:
                    archive, = (base / 'backups').glob('*.tar.gz')
                    assert archive.stat().st_mode & 0o777 == 0o600
                    assert archive.parent.stat().st_mode & 0o777 == 0o700
                    members = subprocess.check_output(['tar', '-tzf', str(archive)], text=True)
                    assert 'data/ecoku.sqlite3-wal' in members
print('PASS: 4 locales; shell syntax; backup/upgrade success and tar failure; 700/600 modes; WAL retained')
