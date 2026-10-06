import io
import os

for dp, _dn, fn in os.walk("tests/e2e"):
    for f in fn:
        if not f.endswith(".spec.ts"):
            continue
        p = os.path.join(dp, f)
        for i, l in enumerate(io.open(p, encoding="utf-8", errors="replace").read().split("\n")):
            if 'getByRole("link"' in l or "getByRole('link'" in l:
                print("%s:%d: %s" % (p, i + 1, l.strip()[:110]))
