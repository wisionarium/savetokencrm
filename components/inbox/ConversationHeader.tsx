"use client";
import { useState } from "react";
import { useT } from "@/hooks/i18n/useT";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ReplyReviewPanel } from "@/components/inbox/composer/ReplyReviewPanel";
import { JanelaSelo } from "@/components/inbox/JanelaSelo";
import { ZoomDoFio } from "./ZoomDoFio";
import {
  Archive,
  ArrowRight,
  ArrowsClockwise,
  CaretDown,
  Clock,
  DotsThreeVertical,
  IdentificationCard,
  Phone,
  Robot,
  Star,
  X,
} from "@/lib/ui/icons";
import { useAuth } from "@/hooks/auth/AuthProvider";
import { useClaimConversation } from "@/hooks/inbox/useClaimConversation";
import { useReleaseConversation } from "@/hooks/inbox/useReleaseConversation";
import { useSnoozeConversation } from "@/hooks/inbox/useSnoozeConversation";
import {
  useArchiveConversation,
  useCloseConversation,
  useReopenConversation,
} from "@/hooks/inbox/useCloseConversation";
import { useResumeAiAttendance } from "@/hooks/inbox/useResumeAiAttendance";
import { usePauseAiAttendance } from "@/hooks/inbox/usePauseAiAttendance";
import { useAutomaticoAtivo } from "@/hooks/ai/useAutomaticoAtivo";
import { comandoDaConversa, ROTULO_DO_MOTIVO } from "@/lib/inbox/comando-da-conversa";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ReassignDialog } from "@/components/inbox/ReassignDialog";
import type { ConversationWithContact } from "@/hooks/inbox/useConversationsRealtime";
import { rotuloDoContato } from "@/lib/contacts/rotulo-do-contato";
import { iniciaisDoContato } from "@/lib/contacts/iniciais-do-contato";
import { phoneForDisplay } from "@/lib/channels/phone-variants";

interface Props {
  conversation: ConversationWithContact;
  /**
   * Abre o perfil do contato. O casulo decide o destino: `Sheet` abaixo de `md`
   * e painel direito no desktop — o mesmo gesto, dois recipientes.
   */
  onAbrirPerfil?: () => void;
}

/**
 * O CHIP NOMEIA CICLO DE VIDA, NÃO COMANDO.
 *
 * Ele afirmava quem manda — "Automático atendendo", "Aguardando atendente" — a
 * 20px de um selo que responde a MESMA pergunta por outra fonte, e as duas se
 * contradiziam na tela: `conversations.status` não acompanha silêncio, trava de
 * contato nem atribuição, e o motor nunca o lê. Medido em 2026-08-30 num print
 * do dono: "Aguardando atendente" e "Automático" no mesmo cabeçalho.
 *
 * Quem responde "quem manda" é o botão de responsável ("Sem responsável ∨"),
 * que vem de `comandoDaConversa`. Aqui fica só o que o status realmente sabe:
 * o episódio está aberto ou acabou.
 *
 * Cobre os SETE valores do CHECK de propósito — o call site é
 * `t(STATUS_LABEL[status] ?? status)`, e um buraco imprime o token cru em inglês
 * no rosto do atendente. Vigiado pelo invariante de espelho.
 */
const STATUS_LABEL: Record<string, string> = {
  open: "Aberta",
  pending: "Aberta",
  claimed: "Aberta",
  ai_handling: "Aberta",
  resolved: "Resolvida",
  closed: "Fechada",
  archived: "Arquivada",
};

/** Durações do submenu "Lembrar" — o kebab é a única porta deste gesto. */
const LEMBRAR_DURACOES: Array<{ hours: 1 | 3 | 24; label: string }> = [
  { hours: 1, label: "Em 1 hora" },
  { hours: 3, label: "Em 3 horas" },
  { hours: 24, label: "Em 24 horas" },
];

/** Predicado do lembrete — helper fora do render (regra `react-hooks/purity`). */
function lembreteEstaAtivo(snoozeUntil: string | null): boolean {
  return snoozeUntil != null && new Date(snoozeUntil).getTime() > Date.now();
}

export function ConversationHeader({ conversation, onAbrirPerfil }: Props) {
  const t = useT();
  const { user } = useAuth();
  const claim = useClaimConversation();
  const release = useReleaseConversation();
  const close = useCloseConversation();
  const reopen = useReopenConversation();
  const arquivar = useArchiveConversation();
  const retomar = useResumeAiAttendance();
  const pausar = usePauseAiAttendance();
  // "Existe automático nesta org?" — sem isto o selo afirmava que o robô estava
  // atendendo em instalação que nunca configurou agente nenhum.
  const automaticoDaOrg = useAutomaticoAtivo();
  const [reassignOpen, setReassignOpen] = useState(false);
  /**
   * O "Lembrar" vive no kebab (⋮) como submenu — a mutation
   * `useSnoozeConversation` é a mesma, sem aninhar um DropdownMenu dentro do
   * outro.
   */
  const { snooze, cancel } = useSnoozeConversation();
  const lembreteAtivo = lembreteEstaAtivo(conversation.snooze_until ?? null);
  const lembreteOcupado = snooze.isPending || cancel.isPending;

  const c = conversation.contacts ?? null;
  const displayName = rotuloDoContato(c, t);
  const phone = c?.phone_number ? phoneForDisplay(c.phone_number) : null;
  /**
   * A foto vem de `/api/v1/contacts/{id}/avatar`, nunca do `storage_path` — a
   * rota assina a URL do bucket privado, e o caminho cru não é servível. Só
   * monta a `<img>` quando existe arquivo e o contato não está anonimizado; sem
   * isso o navegador pediria a rota para todo contato sem foto e levaria 404 em
   * cada um. O `AvatarFallback` cobre imagem que falha, então as iniciais nunca
   * somem.
   */
  const fotoDoContato =
    c?.id && c.avatar_storage_path && !c.is_anonymized
      ? `/api/v1/contacts/${c.id}/avatar`
      : null;
  const iniciais = iniciaisDoContato(displayName, phone);
  const avatarDoContato = (
    <Avatar className="h-8 w-8 shrink-0">
      {fotoDoContato ? <AvatarImage src={fotoDoContato} alt="" className="object-cover" /> : null}
      <AvatarFallback className="bg-surface-elevated text-[11px] font-medium text-text-muted">
        {iniciais}
      </AvatarFallback>
    </Avatar>
  );
  const status = conversation.status;
  const isMineAssigned = conversation.assigned_to_user_id === user.id;
  const isOpen = status === "open" || conversation.assigned_to_user_id == null;

  /**
   * QUEM MANDA, uma pergunta com uma resposta.
   *
   * Este bloco era três leituras parciais. O selo e o botão de volta liam duas
   * travas (`bot_silenced_until || force_human`); a linha da lista lia uma, por
   * COR; o painel não lia nenhuma. Desde a 0173 há uma quarta situação —
   * "alguém assumiu" — e continuar somando condições à mão aqui é como as três
   * leituras divergiram em primeiro lugar. A regra mora em `lib/inbox`,
   * espelhando os gates que o MOTOR lê, e esta tela só a consome.
   */
  const { comando, automaticoAtivo, travaVigente, motivo } = comandoDaConversa({
    status,
    assigned_to_user_id: conversation.assigned_to_user_id,
    assigned_to_user_name: conversation.assigned_to_user_name ?? null,
    assignee_kind: conversation.assignee_kind ?? null,
    bot_silenced_until: conversation.bot_silenced_until ?? null,
    force_human: c?.force_human ?? null,
    is_blocked: conversation.contacts?.is_blocked ?? null,
    automaticoDaOrg: automaticoDaOrg.data,
  });

  const encerrada = status === "closed" || status === "archived" || status === "resolved";
  /**
   * A VOLTA aparece sempre que há algo a devolver — inclusive em conversa
   * ENCERRADA. Antes ela era condicionada a `status !== "closed"`, e o resultado
   * era um beco sem saída medido: atendente assume, fecha, sai de férias; a
   * conversa fica com o automático parado e, para qualquer colega, sem NENHUMA
   * porta — "Liberar" só existe para o próprio dono e a rota recusa quem não é.
   * `devolverAtendimentoAoAgente` funciona nesse estado (o status fechado está na
   * lista de reativáveis), então esconder o botão escondia uma ação que existe.
   *
   * A condição é `travaVigente`, e NÃO `!automaticoAtivo`: conversa encerrada tem
   * o automático inativo sem ter trava nenhuma, e sair do segundo faria o botão
   * aparecer em toda conversa fechada — clicá-lo REABRIRIA uma conversa que
   * ninguém pediu para reabrir. Oferecer uma ação que não deveria acontecer é
   * pior que não oferecer nenhuma.
   */
  const podeDevolver = travaVigente;
  /**
   * PAUSAR só aparece quando pausar é um gesto DIFERENTE de assumir.
   *
   * Desde a 0173 "Assumir" já cala o automático (a RPC grava o silêncio). Numa
   * conversa sem dono, portanto, "Assumir" e "Pausar o automático" teriam
   * exatamente o mesmo efeito — dois botões para um ato é a confusão que esta
   * entrega existe para acabar, não para dobrar.
   *
   * Sobra o caso em que ele é próprio: a conversa JÁ tem dono e o automático
   * continua de pé. Isso é real e não é raro — o rodízio (`reason='routing'`)
   * distribui sem calar, de propósito, senão uma org em round_robin ficaria sem
   * automático nenhum.
   */
  const podePausar =
    automaticoAtivo && !encerrada && conversation.assigned_to_user_id !== null;
  /**
   * O assistente sugere rascunho, não envia: conversa encerrada ou contato
   * bloqueado/anonimizado desliga a geração (mesma guarda do composer para o
   * que SAI — aqui só há o que sugerir).
   */
  const assistenciaBloqueada =
    encerrada ||
    conversation.contacts?.is_blocked === true ||
    conversation.contacts?.is_anonymized === true;

  if (user.support?.access_mode === "support_readonly") return <header className="flex items-center justify-between border-b p-4">
    <strong>{displayName}</strong><span className="text-sm text-muted-foreground">{STATUS_LABEL[status] ?? status} · Somente leitura</span>
  </header>;
  return (
    // `flex-wrap` porque este header travava a LARGURA DA TELA INTEIRA. Ele
    // media 707px de `min-content` — a identidade do contato encolhia bem
    // (`min-w-0` + `truncate`), mas a barra de ações era `shrink-0` e não
    // quebrava. Como a coluna do meio do inbox é `1fr`, que é
    // `minmax(auto, 1fr)`, ela não podia ficar menor que esses 707px, e o
    // painel de CRM era empurrado 311px para fora da viewport em 1280px.
    //
    // Reorganizar em vez de esconder: acima de ~1440px o header fica IDÊNTICO ao
    // de antes (uma linha), e quando aperta a barra desce para a linha de baixo.
    // Nenhuma ação some — um menu "mais" esconderia o "Lembrar" que a spec
    // `canais-baseline` clica, e, pior, esconderia ação de quem atende.
    //
    // NO CELULAR o padding encolhe (`px-3 py-2`): a coluna de 360px não pode
    // gastar 32px de margem em cada lado para caber a mesma identidade que o
    // desktop mostra folgada. Do `md` para cima, intocado.
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-3 py-2 md:px-4 md:py-3">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          {/*
            ESTRELA (placeholder, novo visual): o mock fixa conversa favorita, e
            HOJE não há campo para isso (persistir exige migration — avisado ao
            dono). Desabilitada com o motivo no tooltip: estrela que finge
            funcionar e esquece no F5 é pior que estrela assumidamente futura.
          */}
          <span className="hidden md:inline" title={t("Favoritar conversa (em breve)")}>
            <Star
              size={16}
              weight="fill"
              className="shrink-0 text-yellow-400"
              aria-hidden
            />
          </span>
          {/*
            FOTO + NOME SÃO UMA PORTA SÓ (decisão do dono): tocar em qualquer um
            dos dois abre o perfil — como no WhatsApp. No desktop o mesmo clique
            expande o painel direito. Um botão com os dois, e não dois alvos
            separados: dois botões dariam dois nomes acessíveis para a mesma
            pessoa e um deles ficaria sem foco visível.
          */}
          {onAbrirPerfil ? (
            <button
              type="button"
              onClick={onAbrirPerfil}
              data-testid="abrir-perfil-do-contato"
              title={t("Ver contato")}
              className="-mx-1 flex min-h-11 min-w-0 items-center gap-2 rounded-md px-1 text-left transition-colors hover:bg-surface-elevated focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden"
            >
              {avatarDoContato}
              {/* Caixa alta por CSS, como na lista (o dado continua intacto). */}
              <span className="truncate text-sm font-semibold uppercase">{displayName}</span>
            </button>
          ) : (
            <>
              {avatarDoContato}
              <h2 className="truncate text-sm font-semibold uppercase">{displayName}</h2>
            </>
          )}
          <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
            {t(STATUS_LABEL[status] ?? status)}
          </Badge>
          {/* Ao lado do estado, não escondido num painel: a pergunta "dá para
              escrever agora?" se faz ANTES de digitar, não depois de receber um
              `failed` com um código de cinco dígitos. */}
          <JanelaSelo
            provider={conversation.channel_sessions?.provider ?? null}
            lastInboundAt={conversation.last_inbound_at}
          />
          {/* Sem esta marca, a conversa em que o robô está calado tem exatamente
              a mesma cara de uma conversa normal — e ninguém entende por que as
              respostas automáticas pararam.
              O testid é o MESMO de antes de propósito: `escalacao-ciclo.spec.ts`
              o clica, e rótulo visível é contrato. O que mudou é o texto DIZER o
              motivo — "alguém assumiu" e "pausado para este cliente" pediam ações
              diferentes e tinham a mesma frase. */}
          {motivo !== null && (
            <Badge
              variant="outline"
              className="h-4 px-1.5 text-[10px]"
              data-testid="badge-atendimento-humano"
            >
              {t(ROTULO_DO_MOTIVO[motivo])}
            </Badge>
          )}
        </div>

        {/*
          RESPONSÁVEL (mock): "Sem responsável ∨" / nome de quem atende.
          É o MESMO `data-testid="comando-da-conversa"` de antes — o e2e
          `inbox-quem-manda` lê "sem respons" daqui. Abre o `ReassignDialog`
          (transferir), que é a porta de trocar o dono sem sair do header.
          O selo de motivo (badge-atendimento-humano) continua na linha de
          cima, intocado: este botão DIZ o dono, o selo EXPLICA o estado.
        */}
        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            data-testid="comando-da-conversa"
            onClick={() => setReassignOpen(true)}
            className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            title={t("Trocar o responsável desta conversa")}
          >
            <span className="truncate">
              {comando.quem === "humano"
                ? (comando.nome ?? t("Atendente"))
                : comando.quem === "automatico"
                  ? t("Automático")
                  : t("Sem responsável")}
            </span>
            <CaretDown size={12} weight="bold" aria-hidden className="shrink-0" />
          </button>
        </div>
        {phone && (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Phone size={11} weight="regular" aria-hidden /> {phone}
          </p>
        )}
      </div>

      {/* `shrink-0` saiu daqui: era ele que impunha o piso de largura. Agora a
          barra pode encolher e quebrar internamente, e os botões continuam
          todos visíveis e clicáveis — só que em duas linhas quando preciso. */}
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {/* O INTERRUPTOR. Um botão, dois rótulos, um slot.
            Fica ANTES de transferir/fechar porque é a ação que a pessoa procura
            quando terminou o que tinha para fazer aqui.

            Dois botões lado a lado foi medido e recusado: a barra de ações já
            estourou a caixa útil de 392px em 1280px uma vez (ver o comentário no
            topo do JSX), e um botão a mais custa ~85px — o cabeçalho ganharia uma
            segunda fileira justo na largura mais apertada. Os dois estados são
            mutuamente exclusivos, então nunca precisam existir juntos.

            O `data-testid` do lado de VOLTA é o mesmo de antes: `escalacao-ciclo`
            o clica, e rótulo/testid visível é contrato. */}
        {podeDevolver && (
          <Button
            size="sm"
            variant="outline"
            disabled={retomar.isPending}
            data-testid="devolver-ao-automatico"
            // O ALCANCE DA VOLTA NÃO É SEMPRE O MESMO, e a tela precisa dizer qual é.
            //
            // `devolverAtendimentoAoAgente` limpa `contacts.force_human`, que é do
            // CLIENTE e não desta conversa: quando foi ela que travou, o clique
            // religa o automático para TODAS as conversas daquela pessoa. Um botão
            // que às vezes faz mais do que o nome promete precisa dizer quando.
            title={
              motivo === "contato_travado"
                ? t("Religa o atendimento automático para este cliente — vale para todas as conversas dele.")
                : t("Devolve esta conversa ao atendimento automático.")
            }
            onClick={() => retomar.mutate({ conversation_id: conversation.id })}
          >
            {retomar.isPending ? t("Devolvendo...") : t("Devolver ao automático")}
          </Button>
        )}
        {podePausar && (
          <Button
            size="sm"
            variant="outline"
            disabled={pausar.isPending}
            data-testid="pausar-o-automatico"
            // `podePausar` já exige dono != null, então este botão NUNCA aparece
            // sem dono — prometer "você assume" aqui seria prometer o que a rota
            // não faz: com dono, ela só cala, nunca rouba a conversa de quem a tem.
            title={t("O atendimento automático para nesta conversa. O dono não muda.")}
            onClick={() => pausar.mutate({ conversation_id: conversation.id })}
          >
            {pausar.isPending ? t("Pausando...") : t("Pausar o automático")}
          </Button>
        )}
        {/*
          TELEFONE (placeholder, novo visual): o mock tem chamada de voz, e a
          voz nasce DESLIGADA (`WACALLS_API_BASE_URL` vazio = sem oferta).
          Desabilitado com o motivo no tooltip — botão que finge ligar e dá
          401 em toda chamada é pior que botão assumidamente futuro.
        */}
        <span className="hidden md:block" title={t("Chamada de voz (em breve)")}>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" disabled>
            <Phone size={16} weight="regular" aria-hidden />
          </Button>
        </span>
        {/*
          ASSISTENTE NO ROBÔ — decisão de produto (mock do dono): o painel
          "Assistência do agente / Sugerir resposta" sai de baixo do fio e mora
          neste popover. O COMPONENTE é o mesmo (`ReplyReviewPanel`, mesma
          query `["reply-drafts", conversationId]`, mesmo fluxo
          gerar→revisar→aprovar/rejeitar) — só mudou de endereço. O dono
          ("Sem responsável ∨", segunda linha) continua ao lado, intocado: o
          botão PERGUNTA, o dono INFORMA.
        */}
        <div className="flex flex-col items-center gap-0.5">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                aria-label={t("Assistente do agente")}
                title={t("Sugerir resposta com o agente")}
              >
                <Robot size={16} weight="duotone" aria-hidden />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-96">
              <ReplyReviewPanel
                conversationId={conversation.id}
                disabled={assistenciaBloqueada}
              />
            </PopoverContent>
          </Popover>
          <div className="hidden md:block">
            <ZoomDoFio userId={user.id ?? null} />
          </div>
        </div>
        {/*
          OS 5 NO KEBAB (⋮) — decisão de produto (mock do dono, refinada pelo
          dono): `Assumir, Transferir, Lembrar, Fechar, Arquivar` vivem neste
          menu, e NADA primário fica exposto na barra — só ícones
          (telefone, robô, ⋮) mais o interruptor `Devolver`/`Pausar` quando
          aplicável. A catraca `tests/unit/inbox-header-nao-trava.test.tsx`
          vigia o NOVO contrato (os 5 no menu). O atalho de teclado de assumir
          (`InboxKeyboardShortcuts`) continua existindo: gesto escondido do
          mouse segue a um toque do teclado.
        */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              aria-label={t("Mais ações")}
            >
              <DotsThreeVertical size={16} weight="bold" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            {/*
              OS 5 NO KEBAB (decisão do dono): Assumir, Transferir, Lembrar,
              Fechar e Arquivar vivem neste menu, ao lado do robô. O RÓTULO
              "Assumir" não muda (contrato de dicionário) e a mutation é a
              mesma do botão exposto que existia aqui — inclusive calar o
              automático junto (0173). O atalho de teclado (`InboxKeyboardShortcuts`,
              `onClaim`) continua assumindo sem abrir o menu.
            */}
            {isOpen && (
              <DropdownMenuItem
                disabled={claim.isPending}
                title={t("Você passa a responder esta conversa e o atendimento automático para aqui.")}
                onClick={() =>
                  claim.mutate({
                    conversation_id: conversation.id,
                    expected_assignee: conversation.assigned_to_user_id,
                  })
                }
              >
                <ArrowRight size={14} aria-hidden />
                {claim.isPending ? t("Assumindo...") : t("Assumir")}
              </DropdownMenuItem>
            )}
            {isMineAssigned && (
              <DropdownMenuItem
                disabled={release.isPending}
                onClick={() => release.mutate({ conversation_id: conversation.id })}
              >
                <ArrowRight size={14} aria-hidden className="rotate-180" />
                {t("Liberar")}
              </DropdownMenuItem>
            )}
            {!encerrada && (
              <DropdownMenuItem onClick={() => setReassignOpen(true)}>
                <ArrowRight size={14} aria-hidden />
                {t("Transferir")}
              </DropdownMenuItem>
            )}
            {!encerrada && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger disabled={lembreteOcupado}>
                  <Clock size={14} aria-hidden />
                  {lembreteAtivo ? t("Lembrete ativo") : t("Lembrar")}
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    {lembreteAtivo ? (
                      <DropdownMenuItem
                        onClick={() => cancel.mutate({ conversation_id: conversation.id })}
                      >
                        {t("Cancelar lembrete")}
                      </DropdownMenuItem>
                    ) : (
                      LEMBRAR_DURACOES.map((d) => (
                        <DropdownMenuItem
                          key={d.hours}
                          onClick={() =>
                            snooze.mutate({
                              conversation_id: conversation.id,
                              duration_hours: d.hours,
                            })
                          }
                        >
                          {t(d.label)}
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            )}
            {!encerrada && (
              <DropdownMenuItem
                onClick={() => {
                  if (confirm(t("Fechar esta conversa?"))) {
                    close.mutate({
                      conversation_id: conversation.id,
                      expected_revision: conversation.service_revision,
                    });
                  }
                }}
              >
                <X size={14} aria-hidden />
                {close.isPending ? t("Fechando...") : t("Fechar")}
              </DropdownMenuItem>
            )}
            {encerrada && (
              <DropdownMenuItem
                onClick={() =>
                  reopen.mutate({
                    conversation_id: conversation.id,
                    expected_revision: conversation.service_revision,
                  })
                }
              >
                <ArrowsClockwise size={14} aria-hidden />
                {reopen.isPending ? t("Reabrindo...") : t("Reabrir")}
              </DropdownMenuItem>
            )}
            {/* ARQUIVAR (#923): tira da frente sem destruir. Mesma regra de
                antes — só mudou de lugar (barra → kebab). */}
            {status !== "archived" && (
              <DropdownMenuItem
                onClick={() => {
                  const aviso = encerrada
                    ? t("Arquivar esta conversa?")
                    : t(
                        "Arquivar encerra este atendimento e guarda a conversa no histórico. Se o cliente escrever de novo, ela volta. Arquivar?",
                      );
                  if (confirm(aviso)) {
                    arquivar.mutate({
                      conversation_id: conversation.id,
                      expected_revision: conversation.service_revision,
                    });
                  }
                }}
              >
                <Archive size={14} aria-hidden />
                {arquivar.isPending ? t("Arquivando...") : t("Arquivar")}
              </DropdownMenuItem>
            )}
            {c?.id && (
              <DropdownMenuItem asChild>
                <Link href={`/app/contacts/${c.id}`} className="flex items-center gap-2">
                  <IdentificationCard size={14} aria-hidden />
                  {t("Ver contato")}
                </Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ReassignDialog
        conversationId={conversation.id}
        open={reassignOpen}
        onOpenChange={setReassignOpen}
      />
    </div>
  );
}
