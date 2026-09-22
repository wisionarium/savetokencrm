---
impacto: capacidade_nova
secao: corrigido
titulo: Fluxo de disparo volta a ser criado e a imagem chega no chat
---

Criar um fluxo de disparo (IA › Fluxos › Disparo) falhava com "Campos inválidos": o formulário montava uma espera de 2,6 segundos que o validador recusa (o piso de espera é 5 minutos, feito para follow-up automático). O intervalo de 2,6 s entre imagem e texto continua existindo — ele é aplicado na hora do disparo, não no cadastro. De quebra, a imagem do produto agora chega de verdade no WhatsApp: antes, mesmo quando o fluxo era criado por outro caminho, o disparo mandava o texto "Imagem do produto" em vez da foto. Fluxos antigos sem imagem continuam funcionando; fluxos antigos com espera curta passam a ser criados sem a espera (o intervalo segue 2,6 s).
