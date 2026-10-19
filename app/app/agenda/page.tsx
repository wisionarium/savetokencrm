import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * A Agenda virou aba de Tarefas (`/app/tasks/agenda`).
 *
 * Esta rota continua existindo como REDIRECT, e não como tela, para não quebrar
 * link antigo: favoritos de quem já usava, e o retorno do OAuth do Google em
 * algum fluxo em voo. A query é preservada — é por ela que a Agenda abre um
 * compromisso (`?compromisso=`), um contato (`?contato=`/`?conversa=`) ou o
 * aviso da conexão (`?ok=`/`?erro=`).
 */
export default async function AgendaRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) {
    if (Array.isArray(valor)) for (const v of valor) qs.append(chave, v);
    else if (valor !== undefined) qs.append(chave, valor);
  }
  redirect(qs.size > 0 ? `/app/tasks/agenda?${qs}` : "/app/tasks/agenda");
}
