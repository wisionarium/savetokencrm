---
impacto: nada_mudou
secao: corrigido
titulo: Áudio volta a sair no canal oficial e falha mostra o motivo
---

Nota de voz gravada no navegador chegava em webm e o canal oficial recusava depois de aceitar, e a falha ainda caía sem código — a tela dizia "falhou" sem motivo. Agora o servidor tenta converter webm em ogg com o próprio binário empacotado quando não há ffmpeg no ambiente (Vercel), mantendo o original intacto se não der. E o retorno da plataforma passa a gravar o código e o motivo na mensagem (ex: meta_131053), então o próximo áudio que falhar já diz o porquê na timeline em vez de falhar mudo.
