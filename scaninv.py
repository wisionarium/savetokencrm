import io
import re

s = io.open(
    "docs/design-system/screen-flow/03-screen-inventory.md", encoding="utf-8", newline=""
).read()
# find Resumo/totals lines with numbers
for i, l in enumerate(s.split("\n")):
    if re.search(r"(Resumo|Total|P0|P1|entregue)", l) and re.search(r"\d+", l) and len(l) < 200:
        print("%d: %s" % (i + 1, l[:130]))
