"use client";
import { TenantSwitcher } from "./TenantSwitcher";
import { UserMenu } from "./UserMenu";
import { SearchTrigger } from "./SearchTrigger";

/**
 * A BARRA DE TOPO — e só no computador.
 *
 * No celular ela não existe mais. O desenho do mensageiro não tem faixa fixa
 * em cima: a home abre com a marca e o filtro, e a navegação inteira mora no
 * rodapé. Tudo o que vivia aqui (busca, idioma, tema, conta, organização)
 * continua a um toque, dentro de "Mais" (`/app/mais`).
 *
 * `hidden md:flex` e não um `if` de JavaScript: a pergunta é de tamanho de
 * tela, então quem responde é o CSS, na primeira pintura. O desktop segue
 * exatamente como era.
 */
export function TopBar() {
  return (
    <header className="sticky top-0 z-20 hidden h-14 items-center justify-between gap-2 border-b bg-background/95 px-3 backdrop-blur md:flex md:gap-4 md:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <TenantSwitcher />
      </div>
      <div className="flex min-w-0 flex-1 justify-center md:max-w-md">
        <SearchTrigger />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <UserMenu />
      </div>
    </header>
  );
}
