// "Anything else?" follow-up shared by the Welcome and Welcome-Back flows. Replies that carry a
// link card or a status text have no buttons of their own (WhatsApp can't put reply buttons on a
// CTA card), so the customer used to hit a dead end. This adds two buttons after them:
//   🏠 Main menu  -> back to the flow's menu ("Please choose an option below 👇")
//   👋 End chat   -> a friendly goodbye; the flow then ends quietly, and ANY later message
//                    (e.g. "Hi") starts the conversation afresh.
// Typing anything else instead of tapping restarts the flow too (data.restartOnUnmatched — see
// lib/botFlowEngine.js), so "ok thanks" never gets a "Sorry, I didn't get that" reply.

export const AFTER_MENU_ID = 'n_after';
export const BYE_ID = 'n_bye';

export function buildAfterMenuNodes({ x = 1180, y = 200 } = {}) {
  return [
    {
      id: AFTER_MENU_ID, type: 'menu', x, y,
      data: {
        text: 'Is there anything else I can help you with? 😊',
        fieldKey: '',
        restartOnUnmatched: true,
        options: [
          { id: 'opt_main_menu', label: '🏠 Main menu' },
          { id: 'opt_end_chat', label: '👋 End chat' },
        ],
      },
    },
    {
      id: BYE_ID, type: 'message', x: x + 280, y: y + 80,
      data: { text: "Thank you for chatting with *HESEOS*! 👋 Have a wonderful day.\n\nWhenever you need us again, just send *Hi* and I'll be right here. 🏡💙" },
    },
  ];
}

// `menuNodeId` is the flow's own main menu node.
export function buildAfterMenuEdges(menuNodeId) {
  return [
    { id: 'e_after_main', source: AFTER_MENU_ID, sourceHandle: 'opt_main_menu', target: menuNodeId },
    { id: 'e_after_end', source: AFTER_MENU_ID, sourceHandle: 'opt_end_chat', target: BYE_ID },
  ];
}
