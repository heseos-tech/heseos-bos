// Non-disclosure agreement shown on /investors before the investment proposal opens.
// Client-safe (plain data, no server imports). Bump NDA_VERSION whenever the wording changes —
// each acceptance is stored with the version the person actually agreed to.

export const NDA_VERSION = '1.1';
export const NDA_TITLE = 'Confidentiality & Non-Disclosure Agreement';

export const NDA_SECTIONS = [
  {
    title: 'Parties',
    body: 'This agreement is between Heseos Technologies Pvt. Ltd., 201, Bootstart, Kharadi, Pune, Maharashtra, 411014 (“Heseos”), and the person who enters their details on this page and accepts it (“you”). It takes effect when you tick the acceptance box and verify the one-time passcode sent to your WhatsApp.',
  },
  {
    title: '1. Why you are receiving this',
    body: 'Heseos is sharing its investment proposal with you so you can consider whether to invest in, partner with or advise Heseos (the “Purpose”). You may use the Confidential Information only for the Purpose.',
  },
  {
    title: '2. What is confidential',
    body: 'Confidential Information means the investment proposal and everything in it or shared alongside it, in any form: financial projections and models, unit economics, pricing, margins, fundraising terms and valuation, market analysis, customer, partner and supplier details, product and technology plans, business strategy, and the fact that Heseos is raising funds. Information you can show was already public, already known to you without any duty of confidence, independently developed by you, or lawfully received from someone else without restriction is not covered.',
  },
  {
    title: '3. What you agree to do',
    body: 'You will keep the Confidential Information secret and protect it with at least the care you give your own confidential material. You will not copy it, download or save it, screenshot or photograph it, forward or republish it, or share it with anyone, other than your own directors, partners, employees and professional advisers who genuinely need it for the Purpose, are told it is confidential, and are bound by duties of confidentiality at least as strict as these. You are responsible for any breach by them.',
  },
  {
    title: '4. Required disclosure',
    body: 'If a court, regulator or law requires you to disclose Confidential Information, you will (where lawful) tell Heseos first, disclose only what is legally required, and help Heseos seek protection for it.',
  },
  {
    title: '5. No licence, no obligation',
    body: 'All Confidential Information remains the property of Heseos. Nothing here gives you any right in Heseos’s intellectual property. Heseos makes no promise that the information is complete or free of error, and neither party is obliged to enter any investment or other transaction. Any such deal needs a separate written agreement.',
  },
  {
    title: '6. Return or deletion',
    body: 'If Heseos asks, or you decide not to proceed, you will stop using the Confidential Information and delete any copies or notes you made of it.',
  },
  {
    title: '7. How long this lasts',
    body: 'Your duties under this agreement continue for three (3) years from the date you accept it. For any information that is a trade secret, they continue for as long as it remains a trade secret.',
  },
  {
    title: '8. If it is breached',
    body: 'You understand that misuse or disclosure of Confidential Information could cause Heseos harm that money alone cannot fix, so Heseos may seek an injunction or other urgent relief in addition to any other remedy available to it.',
  },
  {
    title: '9. Electronic acceptance and records',
    body: 'You agree that ticking the box and verifying the one-time passcode sent to your WhatsApp is your electronic signature and has the same effect as signing on paper, as recognised under the Information Technology Act, 2000. Heseos will record your name, phone number, the time of acceptance, the version of this agreement, your IP address and device details as evidence of your acceptance and of access to the proposal.',
  },
  {
    title: '10. Governing law',
    body: 'This agreement is governed by the laws of India. The courts in Pune, Maharashtra have exclusive jurisdiction over any dispute arising from it.',
  },
];
