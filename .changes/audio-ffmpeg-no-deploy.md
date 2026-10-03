---
impacto: nada_mudou
secao: corrigido
titulo: Conversor de áudio passa a ir junto no deploy
---

A conversão de webm para ogg funcionava no Docker (que tem ffmpeg) mas não na Vercel: o binário não entrava no pacote publicado, então o áudio seguia em webm e a Meta recusava com 131053. Agora o binário empacotado é incluído no build de propósito (com prova no próprio build) e usado como reserva quando não há ffmpeg no ambiente. De quebra, quando a conversão falha o motivo vai ao log em vez de silêncio.
