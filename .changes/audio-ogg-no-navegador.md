---
impacto: nada_mudou
secao: corrigido
titulo: Áudio grava em ogg direto no navegador
---

O navegador gravava em webm e o canal oficial recusava (131053), e no plano gratuito não há servidor com conversor. Agora, quando o navegador não tem ogg nativo (Chrome, Safari), o gravador usa um codificador Ogg Opus em WASM e o arquivo já sai em `audio/ogg` — sem conversão no servidor. Quem tem ogg nativo (Firefox) nem baixa o codificador. De quebra, o ffmpeg empacotado virou dependência opcional: o código já tolerava a ausência, e a imagem de quem instala em VPS não carrega peso morto.
