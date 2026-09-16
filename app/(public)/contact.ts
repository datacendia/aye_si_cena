/**
 * How a customer reaches you.
 *
 * WhatsApp rather than a contact form, and that is a decision rather than a
 * shortcut. A form needs a table, a spam defence, somewhere for the message to
 * land and somebody to remember to look there. WhatsApp is where this business
 * already talks to every client and every supplier, it costs nothing, it cannot
 * be spammed by a bot crawling the page, and the reply arrives in the same
 * thread as the quote will.
 *
 * Set NEXT_PUBLIC_WHATSAPP to your number in international form, digits only.
 */
const NUMBER = process.env.NEXT_PUBLIC_WHATSAPP ?? "51000000000";

export const WHATSAPP_HREF =
  `https://wa.me/${NUMBER}?text=${encodeURIComponent(
    "Hola Aye Si Cena — quisiera consultar por un evento."
  )}`;
