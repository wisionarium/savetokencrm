"use client";
import { useT } from "@/hooks/i18n/useT";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowBendUpLeft,
  Clock,
  EnvelopeSimple,
  Funnel,
  InstagramLogo,
  MagnifyingGlass,
  Phone,
  Robot,
  Star,
  User,
  X,
} from "@/lib/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChipDeEtiqueta } from "@/components/tags/ChipDeEtiqueta";
import { PontoDaEtiqueta } from "@/components/tags/PontoDaEtiqueta";
import { channelLabel, useChannelSessions } from "@/hooks/channels/useChannelSessions";
import { useAssignableMembers } from "@/hooks/inbox/useAssignableMembers";
import { useAuth } from "@/hooks/auth/AuthProvider";
import { useContactTagVocabulary } from "@/hooks/contacts/useContactTagVocabulary";
import { useConversationTagVocabulary } from "@/hooks/inbox/useConversationTags";
import { useConversationCounts } from "@/hooks/inbox/useConversationCounts";
import { logoDaMarca } from "@/lib/branding";
import { useMarcaDaInstalacao } from "@/lib/branding/contexto";
import type { Role, VisibilityMode } from "@/lib/auth/types";

export type InboxTab = "unassigned" | "mine" | "all" | "closed" | "archived" | "ai";

const INBOX_TABS: { value: InboxTab; label: string }[] = [
  { value: "unassigned", label: "Fila" },
  { value: "mine", label: "Minhas" },
  { value: "all", label: "Todas" },
  { value: "closed", label: "Fechadas" },
  // "Arquivadas" fica ao lado de "Fechadas" porque as duas são passado — e
  // separada dela porque são passados diferentes (#923): fechada é atendimento
  // encerrado, arquivada é o que saiu da fila de trabalho sem ser destruído.
  { value: "archived", label: "Arquivadas" },
  // "Automático", não "IA": a palavra deste ator já é contrato em quatro arquivos
  // e no dicionário, e `handoff-por-orcamento.test.ts` usa literalmente "Voltar
  // para a IA" como a sabotagem que deve reprovar. A aba era a última fora do
  // padrão — e ela mudou de significado junto (deixou de filtrar `ai_handling` e
  // passou a perguntar a régua do motor), então o rótulo velho descreveria outra
  // coisa.
  { value: "ai", label: "Automático" },
];

/**
 * Abas onde filtrar por dono faz sentido — e, por consequência, as únicas onde
 * o seletor "Atribuído para" aparece.
 *
 * Fila, Minhas e Automático JÁ definem o dono: a Fila e o Automático só têm
 * conversa sem dono, Minhas só as do operador. Oferecer "atribuído para" ali
 * seria redundância (o "Minhas" duplicado do print) ou contradição (dono X
 * dentro de uma aba que por definição não tem dono). Exportada para ser
 * testável: a troca de aba que não larga o filtro morto é a mesma mentira de
 * tela que o filtro órfão de canal já conta.
 */
export function abaAceitaAtribuido(tab: InboxTab): boolean {
  return tab === "all" || tab === "closed" || tab === "archived";
}

/**
 * Troca de aba levando os refinamentos que continuam válidos — e largando os
 * que morreram. Hoje o único que morre é o `assigned_to` nas abas que já
 * definem o dono (ver `abaAceitaAtribuido`): sem isto, escolher uma atendente
 * em Todas e voltar para Minhas deixaria um filtro invisível aplicado — a
 * lista mostraria "Minhas" filtrada por outra pessoa, sem nada na tela dizendo.
 * Função pura para ser testável sem Radix.
 */
export function aoTrocarDeAba(atual: InboxFiltersValue, nova: InboxTab): InboxFiltersValue {
  if (atual.tab === nova) return atual;
  const next: InboxFiltersValue = { ...atual, tab: nova };
  if (!abaAceitaAtribuido(nova)) delete next.assigned_to;
  return next;
}

/**
 * Visões visíveis por papel + escopo (G4-02, acceptance 1). 'Todas' fica oculta
 * para `agent` quando visibility_mode ≠ 'all'; viewer/manager/admin sempre veem.
 * É apenas cosmético — a RLS (G4-01) é quem garante o escopo mesmo via ?filter=all.
 */
export function visibleInboxTabs(role: Role, mode: VisibilityMode | undefined): InboxTab[] {
  const hideAll = role === "agent" && mode !== "all";
  return INBOX_TABS.filter((t) => !(t.value === "all" && hideAll)).map((t) => t.value);
}

export type LeituraDoFiltro = "todas" | "nao_lidas" | "lidas";

export interface InboxFiltersValue {
  tab: InboxTab;
  search: string;
  leitura: LeituraDoFiltro;
  channel_session_id?: string;
  tag?: string;
  /**
   * Dono filtrado (`unassigned` | uuid) vindo do seletor da gestão — mais o
   * `me` que a aba Minhas põe via `tabToFilter` (o seletor não oferece "Minhas":
   * a aba já é esse filtro). Combina com o resto: leitura, canal, etiqueta e
   * busca viajam juntos para a mesma query. Só existe nas abas de
   * `abaAceitaAtribuido`; ao sair delas, `aoTrocarDeAba` larga o valor.
   */
  assigned_to?: string;
  sem_resposta?: boolean;
  janela_aberta?: boolean;
  seguindo?: boolean;
}

interface Props {
  value: InboxFiltersValue;
  onChange: (next: InboxFiltersValue) => void;
}

export function InboxFilters({ value, onChange }: Props) {
  const t = useT();
  const [searchInput, setSearchInput] = useState(value.search);
  /**
   * O campo escuta o valor de FORA — e só ele.
   *
   * O estado do campo é próprio porque o debounce mora nele. O preço era não
   * saber quando o filtro morria por outro caminho: "Limpar filtros" zerava a
   * busca aplicada e deixava o termo escrito na tela, mostrando uma busca que
   * não valia mais — a mesma mentira de tela que esta entrega existe para matar.
   *
   * A ref guarda o que ESTE campo propagou. Valor de fora diferente dela = a
   * mudança veio de outro lugar, e o campo adota. Igual = foi o próprio campo, e
   * adotar atropelaria quem continuou digitando.
   *
   * ⚠️ O QUE O TESTE ALCANÇA, E O QUE NÃO. Tirar este efeito reprova o primeiro
   * caso de `tests/unit/limpar-filtros-limpa-o-campo.test.tsx` — medido. Já a
   * marca lá embaixo, no timer, NÃO é alcançada por teste determinístico: ela
   * defende a corrida entre o timer disparar e este efeito rodar, e nessa fresta
   * o teste nunca consegue digitar. Medido também: sabotá-la deixa os dois casos
   * verdes. Está escrito aqui em vez de fingir cobertura que não existe.
   */
  const propagado = useRef(value.search);
  useEffect(() => {
    if (value.search !== propagado.current) {
      propagado.current = value.search;
      setSearchInput(value.search);
    }
  }, [value.search]);
  const { data: channels } = useChannelSessions({ refetchInterval: 30_000 });
  const { activeOrg } = useAuth();
  /**
   * A MARCA DA HOME, no celular — e só aqui.
   *
   * O topo fixo do celular saiu; no lugar dele a lista de conversas abre com
   * a marca da instalação (ou da organização, quando ela definiu a sua). É a
   * MESMA precedência do sidebar: organização > instalação > produto.
   *
   * O PNG da Tecla entra como fallback do fork quando a instalação se chama
   * "Tecla" e ainda não configurou um logo próprio. Não mexemos no
   * `DEFAULT_APP_NAME` (há catraca protegendo a marca do produto): quem
   * configurou outro nome não vê o ativo da Tecla.
   */
  const marca = useMarcaDaInstalacao();
  const nomeDaMarca = activeOrg?.marca?.nome ?? marca.name;
  // A MESMA regra da barra lateral (`logoDaMarca`): organização > instalação >
  // ativo da Tecla > nada. Centralizada para as duas telas não divergirem — esta
  // faixa e a barra mostram a mesma marca para a mesma pessoa.
  const logoDaHome = logoDaMarca(nomeDaMarca, activeOrg?.marca?.logoUrl || marca.logoUrl);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const refinamentosAtivos = [
    value.leitura !== "todas",
    value.channel_session_id != null,
    value.tag != null,
    value.assigned_to != null,
    Boolean(value.sem_resposta),
    Boolean(value.janela_aberta),
    Boolean(value.seguindo),
  ].filter(Boolean).length;
  /**
   * As opções são a UNIÃO das duas caixas — as mesmas que o filtro consulta
   * (`conversations.tags` ou `contacts.tags`, no handler da lista).
   *
   * Vinham só do vocabulário de CONVERSA: o marcador escrito no contato nem
   * aparecia para ser escolhido. Quem oferece e quem filtra lendo fontes
   * diferentes é o defeito espelhado — ou a opção existe e devolve vazio, ou o
   * marcador que funciona nunca é oferecido.
   */
  const orgId = activeOrg?.orgId ?? null;
  const { data: tagsDeConversa } = useConversationTagVocabulary(orgId);
  const { data: tagsDeContato } = useContactTagVocabulary(orgId);
  const tagVocabulary = useMemo(
    () =>
      tagsDeConversa == null && tagsDeContato == null
        ? undefined
        : [...new Set([...(tagsDeConversa ?? []), ...(tagsDeContato ?? [])])].sort((a, b) =>
            a.localeCompare(b),
          ),
    [tagsDeConversa, tagsDeContato],
  );
  // Os MESMOS filtros que a lista aplicou. Badge que conta o que a aba não mostra
  // manda o atendente procurar trabalho que não existe — a regra já estava escrita
  // na rota; faltava alcançar os filtros ao lado da aba.
  const { data: counts } = useConversationCounts(activeOrg?.orgId ?? null, {
    unread: value.leitura === "nao_lidas",
    read: value.leitura === "lidas",
    tag: value.tag,
    channel_session_id: value.channel_session_id,
    assigned_to: value.assigned_to,
  });

  /**
   * O filtro "Atribuído para" é ferramenta de GESTÃO.
   *
   * A vendedora (agent/viewer) vê só os filtros dela — leitura, busca, canal,
   * etiqueta — e o escopo continua garantido pela RLS, não por este `if`. Este
   * `if` é cosmético (mesma natureza do `visibleInboxTabs`): esconder o seletor
   * de quem não gerencia fila. Manager entra junto com admin: gerente distribui
   * trabalho como o dono.
   */
  const podeFiltrarPorAtendente = activeOrg?.role === "admin" || activeOrg?.role === "manager";
  const { data: atendentes } = useAssignableMembers(podeFiltrarPorAtendente);

  const tabs = activeOrg
    ? visibleInboxTabs(activeOrg.role, activeOrg.visibility_mode)
    : INBOX_TABS.map((t) => t.value);
  const countFor: Partial<Record<InboxTab, number>> = {
    // `fila` é o nome novo; `unassigned` é o alias que a rota versionada mantém.
    // O `??` cobre a janela em que a página ainda lê um cache de react-query
    // gravado antes do deploy — sem ele o badge sumiria por alguns segundos.
    unassigned: counts?.fila ?? counts?.unassigned,
    // A aba do automático ganhou contador junto com o significado: ela deixou de
    // filtrar `ai_handling` (2 conversas) e passou a mostrar o que o robô conduz
    // (47, na instalação onde isto foi medido). Um número que existe na API e não
    // aparece na tela é trabalho feito que ninguém vê.
    ai: counts?.automatico,
    mine: counts?.mine,
    all: counts?.all,
    closed: counts?.closed,
    archived: counts?.archived,
  };
  // Filtrar por um número que saiu da lista (o operador acabou de excluir o
  // canal) deixa o inbox mostrando um subconjunto — às vezes vazio — sem nada na
  // tela dizendo que há filtro. O número some do dropdown junto com o canal, e o
  // alternador inteiro sumiria com ele se sobrasse menos de dois.
  const filtroForaDaLista =
    value.channel_session_id != null &&
    channels != null &&
    !channels.some((c) => c.id === value.channel_session_id);
  // Alternador só aparece com 2+ números — com um só não há o que alternar.
  const showChannelSwitch = (channels?.length ?? 0) >= 2 || filtroForaDaLista;
  // O MESMO tratamento, agora para a etiqueta. Sem ele, o seletor inteiro some
  // com o filtro AINDA APLICADO — a lista fica num subconjunto, às vezes vazio,
  // e nada na tela diz que há filtro nem oferece como tirá-lo.
  const tagForaDoVocabulario =
    value.tag != null &&
    tagVocabulary != null &&
    !tagVocabulary.includes(value.tag);
  const mostrarSeletorDeTag =
    (tagVocabulary?.length ?? 0) > 0 || tagForaDoVocabulario;
  // O MESMO tratamento do canal, agora para o dono: filtro apontando para
  // quem saiu da equipe mantém o seletor com a opção órfã ("Atendente
  // removido") em vez de sumir com o filtro ainda aplicado. `undefined` =
  // listagem ainda carregando — não é "zero atendentes".
  const atendenteForaDaLista =
    value.assigned_to != null &&
    !["me", "unassigned"].includes(value.assigned_to) &&
    atendentes != null &&
    !atendentes.some((m) => m.user_id === value.assigned_to);

  // O timer lê o valor MAIS RECENTE, não o do render em que foi agendado.
  //
  // Antes, o efeito dependia só de `[searchInput]` e a closure capturava `value`
  // inteiro — `tab` incluso. Digitar e trocar de aba em menos de 250 ms fazia o
  // timer disparar com a aba VELHA e devolver o operador à aba anterior, sem ele
  // ter pedido. Some em teste manual: quem sabe do defeito digita devagar.
  //
  // As refs são o que permite manter `[searchInput]` como única dependência (pôr
  // `value`/`onChange` ali reagendaria o timer a cada render e a busca nunca
  // fecharia) SEM pagar o preço da closure velha.
  const valorRef = useRef(value);
  const onChangeRef = useRef(onChange);
  // A atualização vai num efeito, e não no corpo do render: escrever em ref
  // durante a renderização é proibido pela regra `react-hooks/refs` — o React
  // pode renderizar sem efetivar, e aí a ref passa a apontar para um estado que
  // nunca chegou à tela. O efeito roda depois do commit, quando `value` é real.
  useEffect(() => {
    valorRef.current = value;
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    const t = setTimeout(() => {
      const atual = valorRef.current;
      if (searchInput !== atual.search) {
        // Marca ANTES de propagar: se o efeito de sincronização rodar depois de
        // a pessoa ter digitado mais uma tecla, ele veria o valor que ESTE campo
        // acabou de mandar e o adotaria por cima do que já está na tela. Sem
        // teste que alcance — ver o aviso no efeito lá em cima.
        propagado.current = searchInput;
        onChangeRef.current({ ...atual, search: searchInput });
      }
    }, 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  /**
   * Os refinamentos num lugar só, renderizados duas vezes: inline no desktop e
   * dentro da gaveta no celular. Duas cópias do JSX envelheceriam divergindo —
   * uma com um filtro novo e a outra sem —, então a fonte é esta função.
   */
  function renderRefinamentos() {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {/* Leitura (lidas/não lidas) — um refinamento como os outros, não uma
            segunda fileira de abas: o bloco segmentado de 3 botões repetia os
            nomes das abas ("Todas", "Minhas") e brigava com elas pelo mesmo
            espaço. No select compacto ela combina com aba + atribuído + canal +
            etiqueta na mesma query, sem prometer uma "visão" que ela não é. */}
        <Select
          value={value.leitura}
          onValueChange={(v) => onChange({ ...value, leitura: v as LeituraDoFiltro })}
        >
          <SelectTrigger
            className={cn(
              "h-7.5 w-full rounded-full border-border/60 bg-surface-elevated px-2.5 text-xs shadow-none hover:bg-surface-elevated/80",
              value.leitura !== "todas" && "border-accent bg-accent-soft text-accent font-medium",
            )}
            aria-label={t("Filtrar por leitura")}
          >
            <SelectValue placeholder={t("Todas")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">{t("Todas")}</SelectItem>
            <SelectItem value="nao_lidas">{t("Não lidas")}</SelectItem>
            <SelectItem value="lidas">{t("Lidas")}</SelectItem>
          </SelectContent>
        </Select>

        {/* Atribuído para — SÓ gestão, e SÓ nas abas que não definem o dono.
            "Minhas" não é opção: a aba Minhas já é esse filtro. */}
        {podeFiltrarPorAtendente && abaAceitaAtribuido(value.tab) && (
          <Select
            value={value.assigned_to ?? "all"}
            onValueChange={(v) =>
              onChange({ ...value, assigned_to: v === "all" ? undefined : v })
            }
          >
            <SelectTrigger
              className={cn(
                "h-7.5 w-full rounded-full border-border/60 bg-surface-elevated px-2.5 text-xs shadow-none hover:bg-surface-elevated/80",
                value.assigned_to != null && "border-accent bg-accent-soft text-accent font-medium",
              )}
              aria-label={t("Filtrar por atendente")}
            >
              <SelectValue placeholder={t("Todos os atendentes")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("Todos os atendentes")}</SelectItem>
              <SelectItem value="unassigned">{t("Sem dono")}</SelectItem>
              {atendenteForaDaLista && value.assigned_to != null && (
                <SelectItem value={value.assigned_to}>{t("Atendente removido")}</SelectItem>
              )}
              {atendentes?.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {m.full_name ?? t("Sem nome")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {showChannelSwitch && (
          <Select
            value={value.channel_session_id ?? "all"}
            onValueChange={(v) =>
              onChange({ ...value, channel_session_id: v === "all" ? undefined : v })
            }
          >
            <SelectTrigger
              className={cn(
                "h-7.5 w-full rounded-full border-border/60 bg-surface-elevated px-2.5 text-xs shadow-none hover:bg-surface-elevated/80",
                value.channel_session_id != null && "border-accent bg-accent-soft text-accent font-medium",
              )}
              aria-label={t("Filtrar por número de WhatsApp")}
            >
              <SelectValue placeholder={t("Todos os números")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("Todos os números")}</SelectItem>
              {filtroForaDaLista && value.channel_session_id != null && (
                <SelectItem value={value.channel_session_id}>{t("Número removido")}</SelectItem>
              )}
              {channels?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {channelLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {mostrarSeletorDeTag && (
          <Select
            value={value.tag ?? "all"}
            onValueChange={(v) => onChange({ ...value, tag: v === "all" ? undefined : v })}
          >
            <SelectTrigger
              className={cn(
                "h-7.5 w-full rounded-full border-border/60 bg-surface-elevated px-2.5 text-xs shadow-none hover:bg-surface-elevated/80",
                value.tag != null && "border-accent bg-accent-soft text-accent font-medium",
              )}
              aria-label={t("Filtrar por tag")}
            >
              {/* O gatilho mostra o CHIP da etiqueta filtrada, e não o texto
                  cru: é a mesma cor que a lista mostra ao lado, e é o que
                  faz o filtro ativo se reconhecer de relance — mesma razão
                  do `border-accent` acima. Sem filtro, o texto continua
                  sendo o de sempre (`Todas as tags`). */}
              <SelectValue placeholder={t("Todas as tags")}>
                {value.tag ? (
                  <ChipDeEtiqueta tag={value.tag} className="h-4.5 px-1.5 text-[10px]" />
                ) : (
                  t("Todas as tags")
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("Todas as tags")}</SelectItem>
              {/* A órfã entra na lista: sem ela o Select mostraria o
                  placeholder no lugar do valor JÁ selecionado, e o operador
                  veria "Todas as tags" com um filtro ativo. */}
              {[
                ...(tagVocabulary ?? []),
                ...(tagForaDoVocabulario && value.tag ? [value.tag] : []),
              ].map((tag) => (
                <SelectItem key={tag} value={tag}>
                  {/* Ponto, não chip: a opção é uma linha de 280 px que já
                      divide espaço com o filtro de número. O nome continua
                      sendo o que se lê; a cor só acelera o reconhecimento
                      de quem já conhece o vocabulário da operação. */}
                  <span className="inline-flex items-center gap-2">
                    <PontoDaEtiqueta tag={tag} />
                    {tag}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    );
  }

  function limparRefinamentos() {
    onChange({
      ...value,
      leitura: "todas",
      channel_session_id: undefined,
      tag: undefined,
      assigned_to: undefined,
      sem_resposta: undefined,
      janela_aberta: undefined,
      seguindo: undefined,
    });
  }

  return (
    <div className="border-b border-border bg-background">
      {/*
        A HOME NO CELULAR — marca + filtro. O topo fixo do app acabou; esta
        faixa é a única coisa acima da busca e das abas, e só existe na coluna
        da lista (quando há conversa aberta, a coluna inteira sai). No desktop
        ela não aparece: lá a TopBar e os selects inline continuam.
      */}
      <div className="flex items-center justify-between gap-2 px-3 pt-2 pb-1 md:hidden">
        <div className="flex min-w-0 items-center gap-2">
          {logoDaHome && (
            // Sem moldura: o PNG de quem hospeda aparece como é. Havia um chip
            // branco no tema escuro (`dark:bg-white`), para salvar arte escura
            // contra o fundo quase-preto; ele aparecia como um bloco branco em
            // volta do logo no celular e saiu a pedido do dono.
            // <img> e não next/image: a URL vem do banco/.env e não há
            // allowlist de domínios para o logo de quem hospeda. Alt vazio
            // porque o nome ao lado já é o rótulo da marca.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoDaHome}
              alt=""
              className="h-7 w-auto max-w-[8rem] shrink-0 object-contain"
            />
          )}
          <span className="truncate text-lg font-semibold tracking-tight">{nomeDaMarca}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 shrink-0"
          onClick={() => setFiltrosAbertos(true)}
          aria-label={t("Filtros")}
        >
          <Funnel size={18} weight="regular" aria-hidden />
          {refinamentosAtivos > 0 && (
            <span
              className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent"
              aria-hidden
            />
          )}
        </Button>
      </div>

      <div className="space-y-1.5 px-3 pt-2 pb-1.5 md:pt-2.5">
        <div className="flex items-center gap-1.5">
          {/* Atalho rápido Automático */}
          <button
            type="button"
            onClick={() => onChange(aoTrocarDeAba(value, value.tab === "ai" ? "all" : "ai"))}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors",
              value.tab === "ai"
                ? "border-accent bg-accent-soft text-accent"
                : "border-border/60 bg-surface-elevated text-text-muted hover:text-text hover:bg-surface-elevated/80",
            )}
            title={t("Conversas com Automático")}
            aria-label={t("Automático")}
          >
            <Robot size={15} weight="duotone" />
          </button>

          {/* Atalho rápido Minhas */}
          <button
            type="button"
            onClick={() => onChange(aoTrocarDeAba(value, value.tab === "mine" ? "all" : "mine"))}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors",
              value.tab === "mine"
                ? "border-accent bg-accent-soft text-accent"
                : "border-border/60 bg-surface-elevated text-text-muted hover:text-text hover:bg-surface-elevated/80",
            )}
            title={t("Minhas conversas")}
            aria-label={t("Minhas")}
          >
            <User size={15} />
          </button>

          {/* Campo de Busca */}
          <div className="relative min-w-0 flex-1">
            <MagnifyingGlass
              size={15}
              weight="regular"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle"
              aria-hidden
            />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("Buscar por nome, telefone ou última mensagem…")}
              className="h-8.5 rounded-full border-transparent bg-surface-elevated pl-9 pr-8 text-xs shadow-none focus-visible:border-border focus-visible:bg-background"
              aria-label={t("Buscar conversas")}
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  onChange({ ...value, search: "" });
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={t("Limpar busca")}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Botão de Filtros Nextags com Badge */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "relative flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full border transition-colors",
                  refinamentosAtivos > 0
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border/60 bg-surface-elevated text-text-muted hover:text-text hover:bg-surface-elevated/80",
                )}
                title={t("Filtros avançados")}
                aria-label={t("Filtros avançados")}
              >
                <Funnel size={15} weight="regular" aria-hidden />
                {refinamentosAtivos > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white shadow-xs">
                    {refinamentosAtivos}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-3.5 space-y-3 bg-surface-elevated border-border shadow-2xl rounded-xl z-50">
              <div className="flex items-center justify-between pb-1.5 border-b border-border/70">
                <span className="text-xs font-semibold text-text">{t("Filtros")}</span>
                {refinamentosAtivos > 0 && (
                  <button
                    type="button"
                    onClick={limparRefinamentos}
                    className="text-[11px] text-text-muted hover:text-accent transition-colors"
                  >
                    {t("Limpar filtros")}
                  </button>
                )}
              </div>

              {/* 1. Canal */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-text-muted">{t("Canal")}</label>
                <Select
                  value={value.channel_session_id ?? "all"}
                  onValueChange={(v) =>
                    onChange({ ...value, channel_session_id: v === "all" ? undefined : v })
                  }
                >
                  <SelectTrigger className="h-8 w-full rounded-lg text-xs bg-background border-border/70">
                    <SelectValue placeholder={t("Todos os canais")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("Todos os canais")}</SelectItem>
                    {channels?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {channelLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 2. Atribuição */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-text-muted">{t("Atribuição")}</label>
                <Select
                  value={value.assigned_to ?? (value.tab === "mine" ? "me" : value.tab === "unassigned" ? "unassigned" : "all")}
                  onValueChange={(v) => {
                    if (v === "all") {
                      onChange({ ...value, assigned_to: undefined });
                    } else if (v === "me") {
                      onChange(aoTrocarDeAba({ ...value, assigned_to: undefined }, "mine"));
                    } else if (v === "unassigned") {
                      onChange(aoTrocarDeAba({ ...value, assigned_to: "unassigned" }, "all"));
                    } else {
                      onChange(aoTrocarDeAba({ ...value, assigned_to: v }, "all"));
                    }
                  }}
                >
                  <SelectTrigger className="h-8 w-full rounded-lg text-xs bg-background border-border/70">
                    <SelectValue placeholder={t("Atribuído e não atribuído")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("Atribuído e não atribuído")}</SelectItem>
                    <SelectItem value="me">{t("Minhas conversas")}</SelectItem>
                    <SelectItem value="unassigned">{t("Não atribuído")}</SelectItem>
                    {atendentes?.map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {t("Com")} {m.full_name ?? t("Atendente")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 3. Status da conversa (Estilo Nextags) */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-text-muted">{t("Status da conversa")}</label>
                <Select
                  value={
                    value.sem_resposta
                      ? "sem_resposta"
                      : value.leitura === "nao_lidas"
                        ? "nao_lidas"
                        : value.leitura === "lidas"
                          ? "lidas"
                          : value.seguindo
                            ? "seguindo"
                            : value.janela_aberta
                              ? "janela_aberta"
                              : value.tab === "archived"
                                ? "archived"
                                : value.tab === "closed"
                                  ? "closed"
                                  : "todos"
                  }
                  onValueChange={(v) => {
                    if (v === "todos") {
                      onChange({
                        ...value,
                        leitura: "todas",
                        sem_resposta: undefined,
                        janela_aberta: undefined,
                        seguindo: undefined,
                      });
                    } else if (v === "sem_resposta") {
                      onChange({
                        ...value,
                        sem_resposta: true,
                        janela_aberta: undefined,
                        seguindo: undefined,
                      });
                    } else if (v === "nao_lidas") {
                      onChange({
                        ...value,
                        leitura: "nao_lidas",
                        sem_resposta: undefined,
                        janela_aberta: undefined,
                        seguindo: undefined,
                      });
                    } else if (v === "lidas") {
                      onChange({
                        ...value,
                        leitura: "lidas",
                        sem_resposta: undefined,
                        janela_aberta: undefined,
                        seguindo: undefined,
                      });
                    } else if (v === "seguindo") {
                      onChange({
                        ...value,
                        seguindo: true,
                        sem_resposta: undefined,
                        janela_aberta: undefined,
                      });
                    } else if (v === "janela_aberta") {
                      onChange({
                        ...value,
                        janela_aberta: true,
                        sem_resposta: undefined,
                        seguindo: undefined,
                      });
                    } else if (v === "archived") {
                      onChange(aoTrocarDeAba(value, "archived"));
                    } else if (v === "closed") {
                      onChange(aoTrocarDeAba(value, "closed"));
                    }
                  }}
                >
                  <SelectTrigger className="h-8 w-full rounded-lg text-xs bg-background border-border/70">
                    <SelectValue placeholder={t("Todos os status")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">{t("Todos os status")}</SelectItem>
                    <SelectItem value="sem_resposta">{t("Sem resposta do atendente")}</SelectItem>
                    <SelectItem value="nao_lidas">{t("Não lido")}</SelectItem>
                    <SelectItem value="lidas">{t("Lidas")}</SelectItem>
                    <SelectItem value="seguindo">{t("Seguindo (Marcadas / Quentes)")}</SelectItem>
                    <SelectItem value="janela_aberta">{t("Janela aberta (24h)")}</SelectItem>
                    <SelectItem value="archived">{t("Arquivado")}</SelectItem>
                    <SelectItem value="closed">{t("Fechadas / Bloqueadas")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 4. Etiquetas */}
              {mostrarSeletorDeTag && (
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-text-muted">{t("Etiquetas")}</label>
                  <Select
                    value={value.tag ?? "all"}
                    onValueChange={(v) => onChange({ ...value, tag: v === "all" ? undefined : v })}
                  >
                    <SelectTrigger className="h-8 w-full rounded-lg text-xs bg-background border-border/70">
                      <SelectValue placeholder={t("Todas as tags")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("Todas as tags")}</SelectItem>
                      {tagVocabulary?.map((tag) => (
                        <SelectItem key={tag} value={tag}>
                          <span className="inline-flex items-center gap-2">
                            <PontoDaEtiqueta tag={tag} />
                            {tag}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {/* Filtros ativos (chips removíveis sem rolagem horizontal) */}
        {refinamentosAtivos > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {value.channel_session_id && (
              <span className="inline-flex items-center gap-1 h-5.5 px-2 rounded-full text-[11px] bg-accent-soft text-accent border border-accent">
                <span className="max-w-[100px] truncate">
                  {channels?.find((c) => c.id === value.channel_session_id)?.display_name ?? t("Canal")}
                </span>
                <button
                  type="button"
                  onClick={() => onChange({ ...value, channel_session_id: undefined })}
                  className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                  aria-label={t("Remover filtro de canal")}
                >
                  <X size={10} />
                </button>
              </span>
            )}
            {value.assigned_to === "unassigned" && (
              <span className="inline-flex items-center gap-1 h-5.5 px-2 rounded-full text-[11px] bg-accent-soft text-accent border border-accent">
                <span>{t("Não atribuído")}</span>
                <button
                  type="button"
                  onClick={() => onChange({ ...value, assigned_to: undefined })}
                  className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                  aria-label={t("Remover filtro de atendente")}
                >
                  <X size={10} />
                </button>
              </span>
            )}
            {value.assigned_to && value.assigned_to !== "unassigned" && value.assigned_to !== "me" && (
              <span className="inline-flex items-center gap-1 h-5.5 px-2 rounded-full text-[11px] bg-accent-soft text-accent border border-accent">
                <span className="max-w-[100px] truncate">
                  {atendentes?.find((m) => m.user_id === value.assigned_to)?.full_name ?? t("Atendente")}
                </span>
                <button
                  type="button"
                  onClick={() => onChange({ ...value, assigned_to: undefined })}
                  className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                  aria-label={t("Remover filtro de atendente")}
                >
                  <X size={10} />
                </button>
              </span>
            )}
            {value.sem_resposta && (
              <span className="inline-flex items-center gap-1 h-5.5 px-2 rounded-full text-[11px] bg-accent-soft text-accent border border-accent">
                <span>{t("Sem resposta")}</span>
                <button
                  type="button"
                  onClick={() => onChange({ ...value, sem_resposta: undefined })}
                  className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                  aria-label={t("Remover filtro sem resposta")}
                >
                  <X size={10} />
                </button>
              </span>
            )}
            {value.seguindo && (
              <span className="inline-flex items-center gap-1 h-5.5 px-2 rounded-full text-[11px] bg-accent-soft text-accent border border-accent">
                <Star size={10} weight="fill" className="text-amber-500" />
                <span>{t("Seguindo")}</span>
                <button
                  type="button"
                  onClick={() => onChange({ ...value, seguindo: undefined })}
                  className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                  aria-label={t("Remover filtro seguindo")}
                >
                  <X size={10} />
                </button>
              </span>
            )}
            {value.janela_aberta && (
              <span className="inline-flex items-center gap-1 h-5.5 px-2 rounded-full text-[11px] bg-accent-soft text-accent border border-accent">
                <span>{t("Janela 24h")}</span>
                <button
                  type="button"
                  onClick={() => onChange({ ...value, janela_aberta: undefined })}
                  className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                  aria-label={t("Remover filtro janela aberta")}
                >
                  <X size={10} />
                </button>
              </span>
            )}
            {value.tag && (
              <span className="inline-flex items-center gap-1 h-5.5 px-2 rounded-full text-[11px] bg-accent-soft text-accent border border-accent">
                <PontoDaEtiqueta tag={value.tag} />
                <span className="max-w-[80px] truncate">{value.tag}</span>
                <button
                  type="button"
                  onClick={() => onChange({ ...value, tag: undefined })}
                  className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                  aria-label={t("Remover filtro de tag")}
                >
                  <X size={10} />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={limparRefinamentos}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors ml-1"
            >
              {t("Limpar")}
            </button>
          </div>
        )}

        {/* Desktop: os refinamentos compactos em grid */}
        <div className="hidden md:block">{renderRefinamentos()}</div>
      </div>

      {/* CHIPS no celular; faixa sublinhada no desktop. A faixa antiga quebrava
          em duas linhas porque seis abas não cabem em 280px; chips roláveis
          mostram que há mais conteúdo sem empurrar a lista para baixo. */}
      <Tabs
        value={value.tab}
        onValueChange={(v) => onChange(aoTrocarDeAba(value, v as InboxTab))}
        className="px-3"
      >
        <TabsList className="flex h-auto w-full justify-start gap-2 overflow-x-auto rounded-none bg-transparent p-0 pb-2 [scrollbar-width:none] md:flex-wrap md:overflow-visible md:pb-0">
          {tabs.map((tab) => {
            const meta = INBOX_TABS.find((t) => t.value === tab)!;
            const count = countFor[tab];
            return (
              <TabsTrigger
                key={tab}
                value={tab}
                className="shrink-0 gap-1 rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-xs font-medium text-text-muted data-[state=active]:border-accent data-[state=active]:bg-accent-soft data-[state=active]:text-accent data-[state=active]:shadow-none md:-mb-px md:rounded-none md:border-x-0 md:border-t-0 md:border-b-2 md:border-transparent md:bg-transparent md:px-0 md:pb-2 md:pt-1 md:data-[state=active]:border-accent md:data-[state=active]:bg-transparent md:data-[state=active]:text-text"
              >
                {t(meta.label)}
                {typeof count === "number" && count > 0 && (
                  <span className="text-[11px] tabular-nums opacity-70">{count}</span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      <Sheet open={filtrosAbertos} onOpenChange={setFiltrosAbertos}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] overflow-y-auto rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <SheetTitle className="text-base">{t("Filtros")}</SheetTitle>
          </div>
          <div className="space-y-2 px-4 py-3">{renderRefinamentos()}</div>
          <div className="flex gap-2 border-t border-border p-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={limparRefinamentos}
              disabled={refinamentosAtivos === 0}
            >
              {t("Limpar filtros")}
            </Button>
            <Button type="button" className="flex-1" onClick={() => setFiltrosAbertos(false)}>
              {t("Ver resultados")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
