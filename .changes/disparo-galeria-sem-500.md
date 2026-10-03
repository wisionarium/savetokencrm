---
impacto: nada_mudou
secao: corrigido
titulo: Disparo com foto da galeria não derruba mais a conversa
---

Disparar um fluxo com foto da galeria falhava com erro 500: o validador de posse só aceitava foto da conversa ou de dispatch-flows, e a rota não tratava a recusa. Agora a galeria da própria organização é aceita e, se algum passo falhar, a tela recebe um erro 422 com motivo em vez de 500. De quebra, áudio, vídeo e documento no fluxo vão no formato certo (antes tudo saía como imagem) e o upload de áudio registra no log quando o conversor não está disponível no servidor.
