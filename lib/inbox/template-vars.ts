/**
 * Interpola variáveis de template com dados do contato da conversa.
 * Suporta a notação moderna de arroba `@variavel` (@primeiro_nome, @nome, @telefone, @email...),
 * além de compatibilidade retroativa com {{chave}} e [chave].
 * Variável sem valor ou desconhecida mantém o literal — nunca gera texto quebrado.
 */

export interface TemplateVariableDef {
  key: string;
  label: string;
  description: string;
  example: string;
  badge: string;
}

export const TEMPLATE_VARIABLES: TemplateVariableDef[] = [
  {
    key: "primeiro_nome",
    label: "Primeiro nome",
    description: "Primeiro nome da pessoa que chama",
    example: "Carlos",
    badge: "@primeiro_nome",
  },
  {
    key: "nome",
    label: "Nome completo",
    description: "Nome completo cadastrado no perfil",
    example: "Carlos Silva",
    badge: "@nome",
  },
  {
    key: "telefone",
    label: "Telefone / WhatsApp",
    description: "Número do WhatsApp ou telefone",
    example: "(11) 98765-4321",
    badge: "@telefone",
  },
  {
    key: "email",
    label: "E-mail",
    description: "E-mail registrado no perfil",
    example: "carlos@exemplo.com",
    badge: "@email",
  },
  {
    key: "empresa",
    label: "Empresa / Organização",
    description: "Nome da empresa ou organização",
    example: "Tech Soluções",
    badge: "@empresa",
  },
  {
    key: "tags",
    label: "Tags / Etiquetas",
    description: "Etiquetas do contato no CRM",
    example: "Cliente, VIP",
    badge: "@tags",
  },
  {
    key: "documento",
    label: "CPF / Documento",
    description: "Documento cadastrado no perfil",
    example: "123.456.789-00",
    badge: "@documento",
  },
  {
    key: "aniversario",
    label: "Data de nascimento",
    description: "Aniversário ou data de nascimento",
    example: "15/05/1990",
    badge: "@aniversario",
  },
];

export interface TemplateContact {
  name?: string | null;
  display_name?: string | null;
  phone_number?: string | null;
  telefone?: string | null;
  email?: string | null;
  organization_name?: string | null;
  empresa?: string | null;
  tags?: string[] | string | null;
  cpf_hash?: string | null;
  documento?: string | null;
  birthdate?: string | null;
  aniversario?: string | null;
  [key: string]: unknown;
}

/**
 * Remove e converte símbolos legados de colchetes e chaves {{...}} ou [...] para @variavel.
 * Usado na aba de respostas rápidas para que nenhum símbolo [] ou {} precise ser colocado.
 */
export function cleanTemplateSymbols(text: string): string {
  if (!text) return "";
  let result = text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, "@$1");
  result = result.replace(/\{\s*([a-zA-Z0-9_]+)\s*\}/g, "@$1");
  result = result.replace(/\[\[\s*([a-zA-Z0-9_]+)\s*\]\]/g, "@$1");
  result = result.replace(/\[\s*([a-zA-Z0-9_]+)\s*\]/g, "@$1");
  return result;
}

function resolveContactField(key: string, contact: TemplateContact): string | null {
  const k = key.toLowerCase().trim();
  const full = (contact.name ?? contact.display_name ?? "").trim();
  const first = full.split(/\s+/)[0] ?? "";
  const phone = (contact.phone_number ?? contact.telefone ?? "").trim();
  const mail = (contact.email ?? "").trim();
  const org = (contact.organization_name ?? contact.empresa ?? "").trim();
  const tagsStr = Array.isArray(contact.tags)
    ? contact.tags.filter(Boolean).join(", ")
    : typeof contact.tags === "string"
      ? contact.tags.trim()
      : "";
  const doc = (contact.documento ?? contact.cpf_hash ?? "").trim();
  const bday = (contact.aniversario ?? contact.birthdate ?? "").trim();

  switch (k) {
    case "nome":
    case "name":
    case "nome_completo":
      return full !== "" ? full : null;
    case "primeiro_nome":
    case "primeironome":
    case "first_name":
    case "firstname":
      return first !== "" ? first : null;
    case "telefone":
    case "phone":
    case "phone_number":
    case "whatsapp":
    case "celular":
      return phone !== "" ? phone : null;
    case "email":
    case "e-mail":
      return mail !== "" ? mail : null;
    case "empresa":
    case "company":
    case "organizacao":
    case "organization":
      return org !== "" ? org : null;
    case "tags":
    case "tag":
    case "etiquetas":
      return tagsStr !== "" ? tagsStr : null;
    case "documento":
    case "cpf":
    case "cnpj":
      return doc !== "" ? doc : null;
    case "aniversario":
    case "aniversário":
    case "birthdate":
    case "nascimento":
      return bday !== "" ? bday : null;
    default:
      return null;
  }
}

export function interpolateTemplate(body: string, contact: TemplateContact): string {
  if (!body) return "";

  // 1. Suporte a {{chave}} legado
  let result = body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (literal, rawKey: string) => {
    const val = resolveContactField(rawKey, contact);
    return val !== null ? val : literal;
  });

  // 2. Suporte a [chave] legado
  result = result.replace(/\[\[\s*([a-zA-Z0-9_]+)\s*\]\]/g, (literal, rawKey: string) => {
    const val = resolveContactField(rawKey, contact);
    return val !== null ? val : literal;
  });
  result = result.replace(/\[\s*([a-zA-Z0-9_]+)\s*\]/g, (literal, rawKey: string) => {
    const val = resolveContactField(rawKey, contact);
    return val !== null ? val : literal;
  });

  // 3. Suporte ao padrão moderno @chave (exclui e-mails normais como foo@bar.com)
  result = result.replace(/(^|[\s,.;:!?¡¿()\[\]{}"'«»])@([a-zA-Z_][a-zA-Z0-9_]*)/g, (fullMatch, prefix, rawKey: string) => {
    const val = resolveContactField(rawKey, contact);
    if (val !== null) {
      return `${prefix}${val}`;
    }
    return fullMatch;
  });

  return result;
}

