---
impacto: capacidade_nova
secao: alterado
titulo: Notificações e avisos na identidade Sage + imagens sem corte
---

Todas as notificações (toasts), popups (diálogos, confirmações, sheets) e avisos agora falam a mesma língua visual: overlay quente em vez de preto puro, cartões em surface com borda do sistema, raio de modal e ícones de estado nas cores calibradas (Sage) em vez do vermelho genérico — no claro e no escuro. As ~90 ocorrências de cores cruas do Tailwind espalhadas pelo produto (vermelhos, âmbares, azuis, verdes, roxos) viraram tokens de estado, o que ainda enxugou os `dark:` duplicados, já que o token troca de tema sozinho. Nas imagens do fluxo de disparo, a prévia mostra a proporção original (retrato continua retrato — o envio nunca cortou, só a prévia cortava) e a compactação antes do upload ficou mais generosa: lado maior até 2048px e JPEG q0.88, com as dimensões reais guardadas na Galeria.
