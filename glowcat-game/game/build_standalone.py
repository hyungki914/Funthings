#!/usr/bin/env python3
"""6개 브라우저 스크립트를 index.html에 인라인해 단일 자립형 HTML을 생성.
무서버·오프라인 — 결과 파일(ziro_standalone.html)만 더블클릭하면 플레이.
사용: python3 build_standalone.py
"""
import os, re
HERE = os.path.dirname(os.path.abspath(__file__))
ORDER = ["assets.js", "illust.js", "core.js", "data.js", "audio.js", "journal.js", "main.js"]

html = open(os.path.join(HERE, "index.html"), encoding="utf-8").read()
for name in ORDER:
    code = open(os.path.join(HERE, name), encoding="utf-8").read()
    # </script> 안전 처리(혹시 모를 충돌 방지)
    code = code.replace("</script>", "<\\/script>")
    block = f"<script>\n/* ===== {name} ===== */\n{code}\n</script>"
    html = re.sub(r'<script src="%s"></script>' % re.escape(name), lambda m: block, html, count=1)

# 남은 외부 src(없어야 정상) 경고
leftover = re.findall(r'<script src="[^"]+"></script>', html)
out = os.path.join(HERE, "ziro_standalone.html")
open(out, "w", encoding="utf-8").write(html)
print("built", out, f"({os.path.getsize(out)//1024} KB)", "| 남은 외부 src:", leftover or "없음")
