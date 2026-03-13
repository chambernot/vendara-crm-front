/**
 * Constantes relacionadas ao WhatsApp Business
 */

/**
 * Número oficial do WhatsApp da Vendara
 */
export const VENDARA_WHATSAPP = '+55 11 96372 3387';

/**
 * Link da vitrine online da Vendara
 */
export const VENDARA_VITRINE_URL = 'https://vendara.com.br/vitrine';

/**
 * Mensagem de boas-vindas padrão para novos contatos
 * Inclui link da vitrine e número oficial
 */
export const VENDARA_WELCOME_MESSAGE = `Olá! 👋

Seja bem-vindo(a) à *Vendara*! ✨

Visite nossa vitrine online e confira nossos produtos:
🔗 ${VENDARA_VITRINE_URL}

Ou fale conosco diretamente pelo WhatsApp oficial:
📱 ${VENDARA_WHATSAPP}`;

/**
 * Mensagem curta de apresentação (para prefixar mensagens)
 */
export const VENDARA_INTRO_SHORT = `🔗 Conheça nossa vitrine: ${VENDARA_VITRINE_URL}\n📱 WhatsApp oficial: ${VENDARA_WHATSAPP}\n\n`;

/**
 * Gera mensagem de primeiro contato personalizada
 */
export function getFirstContactMessage(clientName?: string): string {
  const greeting = clientName ? `Olá ${clientName}! 👋` : 'Olá! 👋';
  
  return `${greeting}

Seja bem-vindo(a) à *Vendara*! ✨

Veja nossos produtos na vitrine online:
🔗 ${VENDARA_VITRINE_URL}

Atendimento WhatsApp:
📱 ${VENDARA_WHATSAPP}`;
}
