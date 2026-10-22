import type { Role } from "@/lib/auth/types";

/**
 * Registro de navegação — a ÚNICA lista de destinos do app do tenant.
 *
 * Antes disto, três listas descreviam o mesmo conjunto e divergiam: `NAV_ITEMS`
 * no Sidebar, `LINKS` no hub de Configurações e `TABS` na área de IA. Sete telas
 * só eram alcançáveis por dentro da própria seção e uma não tinha link nenhum.
 *
 * Sidebar, hubs e a paleta ⌘K são PROJEÇÕES puras deste array — nenhum deles
 * decide o que existe, só desenha o que sai daqui. Tela nova aparece nos três
 * sem editar três arquivos, e `tests/unit/navegacao-completude.test.ts` reprova
 * o CI se uma rota nascer fora daqui.
 *
 * Doutrina: docs/doctrine/sistema-vivo.md — "por qual porta se chega até mim?"
 */

export type NavGroupId = "atendimento" | "crm" | "ferramentas" | "fluxos" | "canais" | "organizacao";

export interface NavGroup {
  id: NavGroupId;
  label: string;
  /**
   * Hub do grupo — hoje só Organização usa (no rodapé, como "Configurações").
   * O rótulo é declarado junto do href porque não é derivável.
   */
  hub?: { href: string; label: string };
}

export interface NavMetadata {
  href: string;
  label: string;
  /** Aparece no ⌘K e é texto buscável. Nunca vazio. */
  description: string;
  icon: string;
  group: NavGroupId;
  /** Obrigatória em grupo com hub — é o agrupamento por jornada dentro dele. */
  section?: string;
  /** Ausente = viewer. Ver a regra de escolha abaixo. */
  minRole?: Role;
  /** Ausente = fora do menu (só ⌘K). `true` = aparece clicando no bloco. */
  sidebar?: boolean;
  healthDot?: boolean;
}

/**
 * Grupos por OBJETIVO, na ordem de uso: o que se abre toda hora primeiro, o que
 * se ajusta uma vez por mês por último.
 *
 * "Ferramentas" é onde ficam os insumos de quem atende — respostas rápidas e
 * galeria — em vez de disputarem o bloco de Atendimento, que é o dia a dia.
 *
 * Sem hubs no meio (só Organização mantém o seu, no rodapé): todo destino do
 * grupo aparece clicando no bloco, e os grupos nascem todos recolhidos.
 */
export const NAV_GROUPS: NavGroup[] = [
  { id: "atendimento", label: "Atendimento" },
  { id: "crm", label: "CRM" },
  { id: "ferramentas", label: "Ferramentas" },
  // Bandeja própria dos fluxos desde 2026-10-06 (decisão do dono): os fluxos
  // têm bloco só deles — follow-up, disparo e automação, na página
  // /app/ai/fluxos.
  { id: "fluxos", label: "Fluxos" },
  { id: "canais", label: "Canais" },
  {
    id: "organizacao",
    label: "Organização",
    hub: { href: "/app/settings", label: "Configurações" },
  },
];

/**
 * Grupo cujo hub vive no RODAPÉ fixo do sidebar, fora da área que rola.
 *
 * Medido em tela (1280×768, o notebook comum): com todos os grupos na área
 * rolável, o conteúdo dava 1019px contra 663px visíveis — Configurações ficava
 * fora da dobra em TODAS as alturas testadas, inclusive 1080px. É o item que
 * mais se procura quando não se acha algo; deixá-lo dependendo de scroll
 * recriaria, em outra forma, o problema que esta reorganização veio resolver.
 */
export const GRUPO_NO_RODAPE: NavGroupId = "organizacao";

/**
 * Como `minRole` foi escolhido — medido tela a tela, não estimado:
 *
 *   1. A página redireciona por papel?  → usa esse papel. Assim a navegação
 *      nunca mostra um link que morre em /403.
 *   2. Não redireciona, mas a navegação antiga já filtrava? → mantém o filtro
 *      antigo, para esta mudança reorganizar sem alterar quem vê o quê.
 *   3. Nenhum dos dois → viewer.
 *
 * `ROLE_RANK` só distingue papel dentro do tenant; capacidade interna da tela
 * (`canShare` em Respostas rápidas, `canCompare` em Desempenho) NÃO é porta
 * fechada e por isso não vira `minRole`.
 */
export const NAV_CATALOG = [
  // ---- Atendimento — onde o operador passa o dia ----
  //
  // Decisão do dono (2026-10-06, revista no mesmo dia): o sidebar volta a
  // mostrar o uso diário. Só os FLUXOS saíram do menu (moram na página
  // "Fluxos", /app/ai/fluxos) e 4 itens de configuração foram para o hub
  // Configurações (Conexões, Provedores, Roteadores, Webhooks). Todo o resto
  // segue no menu em bandeja recolhida; o que não está no menu continua no
  // registro — e portanto no ⌘K, nos hubs e por URL direta. Para devolver um
  // destino ao menu, basta devolver `sidebar: true` nele.
  {
    href: "/app/inbox",
    label: "Inbox",
    description: "As conversas de WhatsApp, com você e a IA atendendo lado a lado.",
    icon: "Inbox",
    group: "atendimento",
    sidebar: true,
  },
  {
    // Renomeado de "Templates": estes são scripts do atendente, consumidos pelo
    // Composer do inbox. O nome "Templates" fica livre para os da Meta (HSM),
    // onde é o termo técnico correto.
    href: "/app/templates",
    label: "Respostas rápidas",
    description: "Scripts salvos para responder mais rápido, seus ou da equipe.",
    icon: "FileText",
    group: "ferramentas",
    sidebar: true,
  },
  {
    // Biblioteca do time: tudo que foi subido no chat, nos fluxos e direto
    // aqui. Inbound do cliente nunca entra — a origem é de quem escreve.
    href: "/app/galeria",
    label: "Galeria",
    description: "As imagens do time: do chat, dos fluxos e as suas pastas.",
    icon: "ImageSquare",
    group: "ferramentas",
    sidebar: true,
  },

  // ---- CRM — o funil ----
  //
  // ⚠️ FUNIS E ETAPAS DO FUNIL SAÍRAM DO MENU (decisão do dono). Os dois
  // destinos seguem no registro, vivos: saem do MENU, não do produto (mesmo
  // critério de Canais e Nuvemshop, mais abaixo). Continuam alcançáveis pelo
  // ⌘K e por links de dentro do produto — conversões de formulário, detalhe de
  // webhook, avisos do CRM e onboarding apontam para eles. O bloco do CRM no
  // menu fica com Contatos, Tarefas e Produtos; o rail passa a usar Contatos
  // como principal do grupo.
  {
    href: "/app/contacts",
    label: "Contatos",
    description: "As pessoas do outro lado da conversa e seu histórico.",
    icon: "Users",
    group: "crm",
    section: "O dia a dia da venda",
    sidebar: true,
  },
  {
    // Extraída do PR #418 (@clinicacentrodosorrisosc-code). Fica no CRM e no
    // sidebar porque é tela de USO DIÁRIO — quem atende abre para ver o que
    // vence hoje, do mesmo jeito que abre o Inbox. Sem `minRole`: `viewer` VÊ
    // o que o time combinou (é informação de operação), e a criação é cobrada
    // pela rota, com `requireRole("agent")`.
    href: "/app/tasks",
    label: "Tarefas",
    description: "O que ficou combinado, com prazo — e o que já venceu sem ninguém fazer.",
    icon: "ListChecks",
    group: "crm",
    section: "O dia a dia da venda",
    sidebar: true,
  },
  {
    // Estava enterrado em Configurações e ninguém sabia que existia — o achado
    // que originou esta reorganização. A URL não muda; só o lugar na navegação.
    //
    // ⚠️ ERA "Funis", nome que ele DISPUTAVA com o destino acima: os dois
    // listavam as mesmas linhas de `crm_pipelines`, lado a lado no mesmo grupo,
    // com nomes que não diziam qual servia para quê. A diferença real é o VERBO,
    // e é ela que o nome carrega agora: lá se ABRE o funil, aqui se CONFIGURA o
    // que ele significa.
    //
    // Fora do MENU desde a mesma decisão que tirou "Funis" (ver o comentário do
    // bloco CRM): continua no registro, no ⌘K (com o `minRole` de sempre) e no
    // link de dentro de Evolução do agente.
    href: "/app/settings/tenant/pipelines",
    label: "Etapas do funil",
    description: "As colunas de cada funil, o vocabulário do negócio e os motivos de perda.",
    icon: "Funnel",
    group: "crm",
    section: "Preparar a venda",
    minRole: "manager",
  },

  // ---- Fluxos — follow-up, disparo e automação ----
  {
    // Bloco próprio desde 2026-10-06 (decisão do dono): os 3 fluxos moram
    // aqui, FORA de Agente de IA — follow-up, disparo e automação. As rotas
    // antigas seguem no registro (porta via ⌘K/URL), mas a porta navegável é
    // esta página.
    href: "/app/ai/fluxos",
    label: "Fluxos",
    description: "Os fluxos do agente num lugar só: follow-up, disparo e automação.",
    icon: "FlowArrow",
    group: "fluxos",
    minRole: "manager",
    sidebar: true,
  },
  {
    // Sem `sidebar`: a porta é a aba "Fluxo de follow-up" de /app/ai/fluxos.
    // Segue no registro (e no ⌘K) como rota interna.
    href: "/app/ai/followups",
    label: "Follow-ups",
    description: "Como o agente retoma uma conversa que esfriou, para nenhuma morrer no silêncio.",
    icon: "FlowArrow",
    group: "fluxos",
    minRole: "manager",
  },
  {
    // Sem `sidebar`: chega-se pela aba "Fluxos de disparo" de /app/ai/fluxos
    // (botão "Novo fluxo de disparo") e pelo breadcrumb do editor.
    href: "/app/ai/followups/novo-disparo",
    label: "Novo fluxo de disparo",
    description: "Criar imagem + texto para os atendentes dispararem no chat.",
    icon: "FlowArrow",
    group: "fluxos",
    minRole: "manager",
  },
  // ---- Canais — por onde as mensagens entram e saem ----
  //
  // Desde 2026-10-06 (decisão do dono) este grupo não ocupa linha no menu: as
  // conexões (QR + canal oficial da Meta) e os webhooks moram no hub
  // Configurações, e a Nuvemshop segue só no ⌘K. O grupo continua declarado
  // porque a Nuvemshop aponta para ele.
  {
    // Em Configurações desde 2026-10-06 (decisão do dono): é onde se conecta o
    // número (QR) e o canal oficial da Meta — configuração da empresa, ao lado
    // de Provedores e Roteadores. O `healthDot` segue declarado (a casca usa
    // onde houver porta com saúde).
    href: "/app/connections",
    label: "Conexões",
    // Cobre os DOIS caminhos desde o PR #105: número por QR e canal oficial da
    // Meta (com os templates dele), cada um numa aba. A descrição cita "oficial"
    // e "Meta" de propósito — é por esses nomes que se procura no ⌘K, e a busca
    // varre a descrição além do rótulo.
    description:
      "Seus números de WhatsApp: por QR ou canal oficial da Meta, com saúde, reconexão e templates.",
    icon: "PlugsConnected",
    group: "organizacao",
    section: "Sua empresa",
    minRole: "admin",
    healthDot: true,
  },
  {
    // Não tinha link nenhum no app inteiro: só se chegava digitando a URL.
    href: "/app/integrations/nuvemshop",
    label: "Nuvemshop",
    description: "Conecte a loja para trazer pedidos e clientes para dentro do CRM.",
    icon: "Storefront",
    group: "canais",
    // A página não filtra por papel, mas as Server Actions de conectar e
    // desconectar exigem admin — mostrar a um viewer seria oferecer botão morto.
    minRole: "admin",
    // SEM `sidebar`: fora do menu lateral por decisão do dono do produto — a
    // integração não é usada nesta instalação e ocupava uma linha de "Canais"
    // toda vez que alguém abria o app.
    //
    // Continua sendo DESTINO, e é por isso que a linha some em vez do bloco
    // inteiro: `searchable()` (abaixo) filtra só por papel, então a tela segue
    // no ⌘K; a rota, a página e as Server Actions ficam intactas; e
    // `tests/unit/navegacao-completude.test.ts` continua vendo uma porta para
    // `/app/integrations/nuvemshop` — apagar a entrada exigiria justificá-la na
    // allowlist de "rota sem porta", que é coisa de rota morta, e esta não está.
    //
    // ⚠️ O grupo "canais" não tem hub, então o ⌘K passa a ser a ÚNICA porta
    // navegável. Para voltar a mostrá-la, basta devolver `sidebar: true`.
  },
  // ---- Organização — conta, empresa, acesso ----
  {
    href: "/app/settings/profile",
    label: "Perfil",
    description: "Seu nome, idioma, fuso horário e avatar.",
    icon: "UserCircle",
    group: "organizacao",
    section: "Sua conta",
  },
  {
    href: "/app/settings/security",
    label: "Segurança",
    description: "Verificação em duas etapas, códigos de recuperação e sessões.",
    icon: "ShieldCheck",
    group: "organizacao",
    section: "Sua conta",
  },
  {
    href: "/app/settings/notifications",
    label: "Notificações",
    description: "Por onde e sobre o quê você quer ser avisado.",
    icon: "Bell",
    group: "organizacao",
    section: "Sua conta",
  },
  {
    href: "/app/team",
    label: "Equipe",
    description: "Quem trabalha aqui, com qual papel e quanta conversa cada um aguenta.",
    icon: "UsersThree",
    group: "organizacao",
    section: "Sua empresa",
  },
  {
    // A porta que faltava (issue #144): rodízio de atendimento e restrição de
    // visibilidade existiam inteiros no backend e não tinham NENHUMA tela — só
    // dava para ligar com UPDATE à mão no banco.
    href: "/app/settings/atendimento",
    label: "Distribuição de atendimento",
    description: "Quem recebe cada cliente novo, e o que cada atendente enxerga.",
    icon: "UsersThree",
    group: "organizacao",
    section: "Sua empresa",
    minRole: "manager",
  },
  {
    // A porta que faltava para o vocabulário de etiquetas (issue #852). Até
    // aqui a etiqueta só ENTRAva no vocabulário — cada agente escrevia a que
    // quisesse em `add_tag` — e não havia por onde corrigir, juntar as duas
    // grafias que a operação criou, nem tirar a que ninguém mais usa. O
    // vocabulário dava para LER (`/api/v1/conversation-tags`) e não para
    // AJUSTAR, então a única saída era digitar errado para sempre.
    //
    // `manager` e não `admin`, pelo mesmo critério da vizinha acima: quem
    // escreve a etiqueta é quem monta a regra do agente, e a tela existe para
    // quem monta a regra. Nada aqui apaga conversa ou muda dinheiro — o
    // alcance da operação é ao lado do de "Distribuição de atendimento".
    href: "/app/settings/tags",
    label: "Tags",
    description:
      "O vocabulário de etiquetas da empresa: onde cada uma é usada e como renomear, juntar ou excluir.",
    icon: "Tag",
    group: "organizacao",
    section: "Sua empresa",
    minRole: "manager",
  },
  {
    href: "/app/settings/tenant",
    label: "Organização",
    description: "Dados da empresa, retenção de dados e encarregado de LGPD.",
    icon: "Buildings",
    group: "organizacao",
    section: "Sua empresa",
    minRole: "admin",
  },
  {
    href: "/app/lgpd/requests",
    label: "LGPD",
    description: "Pedidos de exportação e exclusão de dados feitos por clientes.",
    icon: "ScalesSimple",
    group: "organizacao",
    section: "Dados e acesso",
    minRole: "admin",
  },
  {
    // No grupo Organização desde a simplificação (decisão do dono): o que ele
    // responde é auditoria e acesso — "quem fez o quê, quando" —, ao lado de
    // LGPD e API Tokens. SEM `sidebar`: o grupo tem hub, e a porta é
    // "Configurações".
    href: "/app/audit",
    label: "Audit Log",
    description: "Quem fez o quê, quando — o histórico que não se apaga.",
    icon: "ClockCounterClockwise",
    group: "organizacao",
    section: "Dados e acesso",
    minRole: "manager",
  },
] as const satisfies readonly NavMetadata[];

export type NavDestinationId = (typeof NAV_CATALOG)[number]["href"];
