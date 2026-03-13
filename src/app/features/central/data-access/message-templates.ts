import { MessageTemplate } from './central.models';

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: 'followup-preco',
    title: 'Follow-up - Preço',
    body: `Oi {{nome}}! Tudo bem? 😊

Lembrei de você e da nossa conversa sobre {{produto}}. 

Consegui uma condição especial e gostaria de compartilhar com você. O valor está em {{preco}}.

Te mando os detalhes no WhatsApp? Qualquer dúvida, estou à disposição! ✨`,
    tags: ['pediu_preco'],
  },
  {
    id: 'sumiu-lembrete',
    title: 'Sumiu - Lembrete Gentil',
    body: `Oi {{nome}}! Como você está? 💎

Faz um tempinho que não conversamos e pensei em você.

Se ainda estiver interessada nas joias que vimos, estou aqui para ajudar! E se preferir, posso te mostrar as novidades que chegaram.

Me avisa qualquer coisa! 😊`,
    tags: ['sumiu'],
  },
  {
    id: 'presente-especial',
    title: 'Presente Especial',
    body: `Oi {{nome}}! 🎁

Você estava procurando um presente especial, né?

Tenho algumas opções lindas que acho que vão te encantar. São peças delicadas e perfeitas para surpreender!

Quer dar uma olhada? Te mando fotos com todo carinho! ✨`,
    tags: ['presente'],
  },
  {
    id: 'novidades-semana',
    title: 'Novidades da Semana',
    body: `Oi {{nome}}! Tudo bem? 💫

Chegaram novidades lindas essa semana e pensei logo em você!

São peças que combinam muito com seu estilo. Quer que eu te mostre?

Só me avisar que te mando todas as fotos! 😊✨`,
    tags: ['novidades'],
  },
  {
    id: 'pos-venda',
    title: 'Pós-venda',
    body: `Oi {{nome}}! Como você está? 💎

Espero que esteja amando sua nova joia! 

Queria saber como foi a experiência e se está tudo certinho com sua peça.

Qualquer coisa que precisar, é só me chamar! Estou sempre aqui! 😊`,
    tags: ['pos_venda'],
  },
  {
    id: 'colecao-nova',
    title: 'Coleção Nova',
    body: `Oi {{nome}}! 🌟

Acabou de chegar uma coleção nova incrível!

São peças sofisticadas e modernas, com aquele toque especial que você gosta. Tenho certeza que vai adorar!

Posso te mostrar? Preparei uma seleção especial pensando em você! ✨`,
    tags: ['novidades'],
  },
  {
    id: 'promocao-especial',
    title: 'Promoção Especial',
    body: `Oi {{nome}}! Tudo bem? 💝

Temos uma promoção especial rolando e lembrei de você na hora!

{{produto}} está com um precinho maravilhoso: {{preco}}

Mas é só até o final da semana! Quer garantir? 😊`,
    tags: ['pediu_preco', 'novidades'],
  },
  {
    id: 'aniversario-mes',
    title: 'Aniversário do Mês',
    body: `Oi {{nome}}! 🎂💎

Seu aniversário está chegando e não poderia deixar passar em branco!

Preparei uma surpresinha especial para você: 10% de desconto em qualquer peça da loja!

É meu presente para você comemorar em grande estilo! ✨🎉`,
    tags: ['presente', 'novidades'],
  },
];
