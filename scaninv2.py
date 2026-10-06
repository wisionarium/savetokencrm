import io
import re

s = io.open(
    "docs/design-system/screen-flow/03-screen-inventory.md", encoding="utf-8", newline=""
).read()
# find Resumo block
i = s.find("## Resumo")
print(s[i : i + 2500])
