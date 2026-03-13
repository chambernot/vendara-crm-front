import { MessageTemplate } from './template.models';

export const DEFAULT_TEMPLATES: Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    title: 'Follow-up - Preço',
    body: `Oi {{primeiro_nome}}! Tudo bem? 😊

Lembrei de você e da nossa conversa sobre {{produto}}. 

Consegui uma condição especial e gostaria de compartilhar com você. O valor está em {{preco}}.

Te mando os detalhes no WhatsApp? Qualquer dúvida, estou à disposição! ✨`,
    tags: ['pediu_preco'],
    isActive: true,
    isDefault: true,
  },
  {
    title: 'Sumiu - Lembrete Gentil',
    body: `Oi {{primeiro_nome}}! Como você está? 💎

Faz um tempinho que não conversamos e pensei em você.

Se ainda estiver interessada nas joias que vimos, estou aqui para ajudar! E se preferir, posso te mostrar as novidades que chegaram.

Me avisa qualquer coisa! 😊`,
    tags: ['sumiu'],
    isActive: true,
    isDefault: true,
  },
  {
    title: 'Presente Especial',
    body: `Oi {{primeiro_nome}}! 🎁

Você estava procurando um presente especial, né?

Tenho algumas opções lindas que acho que vão te encantar. São peças delicadas e perfeitas para surpreender!

Quer dar uma olhada? Te mando fotos com todo carinho! ✨`,
    tags: ['presente'],
    isActive: true,
    isDefault: true,
  },
  {
    title: 'Novidades da Semana',
    body: `Oi {{primeiro_nome}}! Tudo bem? 💫

Chegaram novidades lindas essa semana e pensei logo em você!

São peças que combinam muito com seu estilo. Quer que eu te mostre?

Só me avisar que te mando todas as fotos! 😊✨`,
    tags: ['novidades'],
    isActive: true,
    isDefault: true,
  },
  {
    title: 'Pós-venda - Agradecimento',
    body: `Oi {{primeiro_nome}}! 💕

Queria agradecer pela confiança em escolher uma das nossas peças!

Espero que esteja amando {{produto}}. Se precisar de qualquer coisa ou tiver alguma dúvida, estou sempre por aqui!

Obrigada pelo carinho! ✨`,
    tags: ['pos_venda'],
    isActive: true,
    isDefault: true,
  },
  {
    title: 'Multi - Retomada de Contato',
    body: `Oi {{nome_completo}}! Tudo bem? 😊

Estava aqui organizando meus contatos e vi que faz um tempo que não conversamos!

Queria saber se posso te ajudar com algo ou se gostaria de ver as novidades que tenho preparado com muito carinho.

Me avisa! Estou à disposição! 💎✨`,
    tags: ['sumiu', 'novidades'],
    isActive: true,
    isDefault: true,
  },
  {
    title: 'Follow-up Leve (Padrão)',
    body: `Oi {{primeiro_nome}}! Tudo bem com você? 😊

Passando aqui só para dar um oi e ver se posso ajudar com alguma coisa!

Se estiver procurando algo especial ou só quiser conversar, estou aqui! 💎✨`,
    tags: ['novidades', 'sumiu'],
    isActive: true,
    isDefault: false,
  },
];
