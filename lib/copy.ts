/**
 * The words on the page, in two languages.
 *
 * Every visible string has a stable key and an English default written here in
 * the code. A row in `site_copy` supersedes the default, which is what makes
 * the copy editable without a deploy — and what makes the Spanish a column
 * rather than an afterthought.
 *
 * The keys are ids, never the English text. Keying on the English is what the
 * standalone does, and it works there because the whole page is rebuilt at
 * once; here, editing a heading would orphan its translation silently.
 *
 * Nothing in this file is optional. `COPY` below is the complete list, both
 * languages, and __tests__/copy.test.ts fails if any entry is missing a
 * Spanish string or if a page renders a key that does not exist.
 */
import { db, siteCopy } from "@/db";

export type Locale = "es" | "en";

export interface Phrase {
  en: string;
  es: string;
  section: string;
}

/**
 * The defaults, and the seed.
 *
 * Sections match the page they appear on, so the admin screen can group them
 * the way somebody editing them would expect.
 */
export const COPY: Record<string, Phrase> = {
  // ---- chrome ----
  "nav.home": { en: "Home", es: "Inicio", section: "nav" },
  "nav.moments": { en: "The evening", es: "La noche", section: "nav" },
  "nav.find": { en: "Find dishes", es: "Buscar platos", section: "nav" },
  "nav.menu": { en: "The matrix", es: "La matriz", section: "nav" },
  "nav.recipes": { en: "Recipes", es: "Recetas", section: "nav" },
  "nav.seasonal": { en: "Season", es: "Temporada", section: "nav" },
  "nav.compare": { en: "Compare", es: "Comparar", section: "nav" },
  "nav.graph": { en: "Ingredients", es: "Insumos", section: "nav" },
  "nav.packages": { en: "Packages", es: "Paquetes", section: "nav" },
  "nav.builder": { en: "Build a menu", es: "Armar el menú", section: "nav" },
  "nav.quotes": { en: "Quotes", es: "Cotizaciones", section: "nav" },
  "nav.clients": { en: "Clients", es: "Clientes", section: "nav" },
  "nav.bookings": { en: "Bookings", es: "Reservas", section: "nav" },
  "nav.prices": { en: "Prices", es: "Precios", section: "nav" },
  "nav.admin": { en: "Admin", es: "Administración", section: "nav" },
  "chrome.signOut": { en: "Sign out", es: "Cerrar sesión", section: "nav" },
  "chrome.footerCosts": {
    en: "All prices in soles, exclusive of IGV. Costs are planning estimates modelled to a 25–30% food cost, not verified supplier quotes.",
    es: "Todos los precios en soles, sin IGV. Los costos son estimados de planificación calculados a un 25–30% de costo de insumos, no cotizaciones verificadas de proveedores.",
    section: "nav" },
  "chrome.footerLine": {
    en: "Aye Si Cena · Lima · Scottish-Peruvian catering",
    es: "Aye Si Cena · Lima · catering escocés-peruano", section: "nav" },

  // ---- login ----
  "login.lede": {
    en: "This menu carries what every dish costs and who supplies it. Sign in to see it.",
    es: "Esta carta lleva lo que cuesta cada plato y quién lo provee. Inicie sesión para verla.",
    section: "login" },
  "login.email": { en: "Email", es: "Correo", section: "login" },
  "login.password": { en: "Password", es: "Contraseña", section: "login" },
  "login.submit": { en: "Sign in", es: "Entrar", section: "login" },
  "login.working": { en: "Checking…", es: "Verificando…", section: "login" },
  "login.refused": {
    en: "That email and password do not match an account.",
    es: "Ese correo y esa contraseña no corresponden a ninguna cuenta.", section: "login" },
  "login.noSignup": {
    en: "There is no sign-up. Accounts are created by the owner, because every account can see something a stranger should not.",
    es: "No hay registro. Las cuentas las crea el dueño, porque toda cuenta ve algo que un desconocido no debería ver.",
    section: "login" },

  // ---- quotes ----
  "quotes.heading": { en: "Quotes", es: "Cotizaciones", section: "quotes" },
  "quotes.ledeOwner": {
    en: "Every quote, newest first. Build a new one on the menu builder and save it from there.",
    es: "Todas las cotizaciones, la más reciente primero. Arme una nueva en el armador de menú y guárdela desde ahí.",
    section: "quotes" },
  "quotes.ledeClient": {
    en: "Every quote we have prepared for you.",
    es: "Todas las cotizaciones que hemos preparado para usted.", section: "quotes" },
  "quotes.empty": { en: "Nothing saved yet", es: "Nada guardado todavía", section: "quotes" },
  "quotes.emptyOwner": {
    en: "Price a menu on the builder, name it, and it will keep.",
    es: "Cotice un menú en el armador, póngale nombre y quedará guardado.", section: "quotes" },
  "quotes.emptyClient": {
    en: "When we prepare a quote for you it will appear here.",
    es: "Cuando preparemos una cotización para usted, aparecerá aquí.", section: "quotes" },
  "quotes.colQuote": { en: "Quote", es: "Cotización", section: "quotes" },
  "quotes.colClient": { en: "Client", es: "Cliente", section: "quotes" },
  "quotes.colGuests": { en: "Guests", es: "Invitados", section: "quotes" },
  "quotes.colTier": { en: "Tier", es: "Nivel", section: "quotes" },
  "quotes.colPays": { en: "Client pays", es: "El cliente paga", section: "quotes" },
  "quotes.colFoodCost": { en: "Food cost", es: "Costo de insumos", section: "quotes" },
  "quotes.colStatus": { en: "Status", es: "Estado", section: "quotes" },
  "quotes.theMenu": { en: "The menu", es: "El menú", section: "quotes" },
  "quotes.whatItCame": { en: "What it came to", es: "A cuánto quedó", section: "quotes" },
  "quotes.asQuoted": {
    en: "As quoted, and not recalculated since — so it still says what you charged.",
    es: "Tal como se cotizó, sin recalcular — así que sigue diciendo lo que usted cobró.",
    section: "quotes" },
  "quotes.net": { en: "Net", es: "Neto", section: "quotes" },
  "quotes.dishes": { en: "dishes", es: "platos", section: "quotes" },
  "quotes.notes": { en: "Notes", es: "Notas", section: "quotes" },
  "quotes.delete": { en: "Delete this quote", es: "Eliminar esta cotización", section: "quotes" },
  "quotes.saveAs": { en: "Save as", es: "Guardar como", section: "quotes" },
  "quotes.save": { en: "Save this quote", es: "Guardar esta cotización", section: "quotes" },
  "quotes.saving": { en: "Saving…", es: "Guardando…", section: "quotes" },
  "quotes.pickFirst": { en: "Pick at least one dish first.", es: "Elija al menos un plato primero.", section: "quotes" },
  "quotes.wonBook": { en: "Won it — put it in the book", es: "Ganada — pásela a la agenda", section: "quotes" },
  "quotes.alreadyBooked": { en: "Already in the book.", es: "Ya está en la agenda.", section: "quotes" },
  "quotes.bookFrom": {
    en: "Guests, tier, district and the dishes come from the quote",
    es: "Invitados, nivel, distrito y platos vienen de la cotización", section: "quotes" },
  "quotes.date": { en: "Date", es: "Fecha", section: "quotes" },
  "quotes.onTable": { en: "On table", es: "En la mesa", section: "quotes" },
  "quotes.booking": { en: "Booking…", es: "Reservando…", section: "quotes" },
  "quotes.putInBook": { en: "Put it in the book", es: "Pasar a la agenda", section: "quotes" },
  "quotes.notYet": { en: "not yet", es: "todavía no", section: "quotes" },
  "quotes.cannotEat": { en: "cannot eat", es: "no puede comer", section: "quotes" },
  "quotes.ofThese": { en: "of these", es: "de estos", section: "quotes" },
  "quotes.dietWarn": {
    en: "From what is recorded against them, not from this menu. Swap the dish or take it off.",
    es: "Según lo registrado para ellos, no según este menú. Cambie el plato o quítelo.",
    section: "quotes" },

  // ---- clients ----
  "clients.heading": { en: "Clients", es: "Clientes", section: "clients" },
  "clients.lede": {
    en: "What they eat, recorded once. Every menu quoted for them is checked against it, so an allergy noted in March still catches a dish in September.",
    es: "Lo que comen, registrado una vez. Cada menú que se les cotiza se revisa contra eso, así que una alergia anotada en marzo sigue detectando un plato en septiembre.",
    section: "clients" },
  "clients.onBooks": { en: "On the books", es: "En cartera", section: "clients" },
  "clients.none": {
    en: "Nobody yet. Add the first one and their diets follow them from then on.",
    es: "Nadie todavía. Agregue al primero y sus dietas lo acompañan desde entonces.",
    section: "clients" },
  "clients.newClient": { en: "A new client", es: "Un cliente nuevo", section: "clients" },
  "clients.name": { en: "Name", es: "Nombre", section: "clients" },
  "clients.phone": { en: "Phone", es: "Teléfono", section: "clients" },
  "clients.district": { en: "District", es: "Distrito", section: "clients" },
  "clients.cannotEat": { en: "What they cannot eat", es: "Lo que no pueden comer", section: "clients" },
  "clients.cannotEatNote": {
    en: "Recorded once. Every menu quoted for them is checked against this.",
    es: "Se registra una vez. Cada menú que se les cotiza se revisa contra esto.",
    section: "clients" },
  "clients.add": { en: "Add this client", es: "Agregar este cliente", section: "clients" },
  "clients.quotesFor": { en: "Quotes", es: "Cotizaciones", section: "clients" },
  "clients.noneQuoted": { en: "Nothing quoted for them yet.", es: "Aún no se les ha cotizado nada.", section: "clients" },
  "clients.hasLogin": { en: "has a login", es: "tiene acceso", section: "clients" },
  "clients.nothingRecorded": {
    en: "Nothing recorded. Anything noted here is checked against every menu quoted for them from then on.",
    es: "Nada registrado. Lo que se anote aquí se revisa contra cada menú que se les cotice de ahí en adelante.",
    section: "clients" },

  // ---- bookings ----
  "bookings.heading": { en: "Bookings", es: "Reservas", section: "bookings" },
  "bookings.lede": {
    en: "What you have actually sold. The day check reads from here, so “can I take this one?” is answered against the Saturday you already have, not an example.",
    es: "Lo que realmente ha vendido. La revisión del día lee de aquí, así que “¿puedo tomar este trabajo?” se responde contra el sábado que ya tiene, no contra un ejemplo.",
    section: "bookings" },
  "bookings.needLook": { en: "Days that need a look", es: "Días que hay que revisar", section: "bookings" },
  "bookings.jobs": { en: "jobs", es: "trabajos", section: "bookings" },
  "bookings.onBooks": { en: "On the books", es: "En agenda", section: "bookings" },
  "bookings.none": {
    en: "Nothing booked. Add one and the day check starts answering from real jobs.",
    es: "Nada reservado. Agregue uno y la revisión del día empieza a responder con trabajos reales.",
    section: "bookings" },
  "bookings.aJob": { en: "A job to take", es: "Un trabajo por tomar", section: "bookings" },
  "bookings.onTable": { en: "On the table", es: "En la mesa", section: "bookings" },
  "bookings.confirmed": { en: "confirmed", es: "confirmada", section: "bookings" },
  "bookings.provisional": { en: "provisional", es: "provisional", section: "bookings" },
  "bookings.confirm": { en: "confirm", es: "confirmar", section: "bookings" },
  "bookings.markProvisional": { en: "mark provisional", es: "marcar provisional", section: "bookings" },
  "bookings.remove": { en: "remove", es: "quitar", section: "bookings" },
  "bookings.save": { en: "Put it in the book", es: "Pasar a la agenda", section: "bookings" },
  "bookings.unjudgeable": {
    en: "One booking could not be checked",
    es: "Una reserva no se pudo revisar", section: "bookings" },

  // ---- prices ----
  "prices.heading": { en: "What things actually cost", es: "Lo que cuestan las cosas de verdad", section: "prices" },
  "prices.lede": {
    en: "Every price the app ships with is an estimate. Write down what you paid at the stall and it applies everywhere immediately — no rebuild, nothing to redownload.",
    es: "Todo precio que trae la aplicación es un estimado. Anote lo que pagó en el puesto y se aplica en todas partes de inmediato — sin recompilar, sin volver a descargar nada.",
    section: "prices" },
  "prices.verifiedOf": { en: "verified of", es: "verificados de", section: "prices" },
  "prices.allGuess": { en: "every figure is still a guess", es: "toda cifra sigue siendo una suposición", section: "prices" },
  "prices.justBack": { en: "Just back from the market", es: "Recién llegado del mercado", section: "prices" },
  "prices.ingredient": { en: "Ingredient", es: "Insumo", section: "prices" },
  "prices.asNamed": {
    en: "As the shopping list names it, lower case.",
    es: "Tal como lo nombra la lista de compras, en minúsculas.", section: "prices" },
  "prices.soles": { en: "Soles", es: "Soles", section: "prices" },
  "prices.per": { en: "Per", es: "Por", section: "prices" },
  "prices.where": { en: "Where", es: "Dónde", section: "prices" },
  "prices.note": { en: "Note", es: "Nota", section: "prices" },
  "prices.record": { en: "Record this price", es: "Registrar este precio", section: "prices" },
  "prices.verified": { en: "Verified", es: "Verificados", section: "prices" },
  "prices.nothingYet": {
    en: "Nothing yet. The first market run is the one that makes every quote real.",
    es: "Nada todavía. La primera salida al mercado es la que vuelve real cada cotización.",
    section: "prices" },
  "prices.paid": { en: "Paid", es: "Pagado", section: "prices" },
  "prices.estimateWas": { en: "Estimate was", es: "El estimado era", section: "prices" },
  "prices.diff": { en: "Diff", es: "Dif.", section: "prices" },
  "prices.revert": { en: "revert", es: "revertir", section: "prices" },
  "prices.diffNote": {
    en: "A diff over 15% either way is worth a second look — it usually means the estimate was wrong rather than the market moving.",
    es: "Una diferencia de más de 15% en cualquier sentido merece una segunda mirada — casi siempre significa que el estimado estaba mal, no que el mercado se movió.",
    section: "prices" },

  // ---- admin ----
  "admin.heading": { en: "Admin", es: "Administración", section: "admin" },
  "admin.lede": {
    en: "The words on the site and the dishes on the menu, editable without a deploy. Both languages, always — a save with an empty Spanish is refused.",
    es: "Las palabras del sitio y los platos de la carta, editables sin desplegar. Siempre en ambos idiomas — se rechaza cualquier guardado con el español vacío.",
    section: "admin" },
  "admin.copy": { en: "Words on the site", es: "Palabras del sitio", section: "admin" },
  "admin.copyLede": {
    en: "Every heading and paragraph, in English and Spanish. The English in the code is the fallback; anything saved here supersedes it.",
    es: "Cada título y párrafo, en inglés y español. El inglés del código es el respaldo; lo que se guarde aquí lo reemplaza.",
    section: "admin" },
  "admin.dishes": { en: "Dishes", es: "Platos", section: "admin" },
  "admin.dishesLede": {
    en: "Name, description, menu price, category and tier. Allergens and the vegetarian flag are not here and never will be — they are read from the recipe, and a field somebody can type over is how a menu ends up offering gluten to a coeliac.",
    es: "Nombre, descripción, valor de carta, categoría y nivel. Los alérgenos y la marca de vegetariano no están aquí ni lo estarán — se leen de la receta, y un campo que alguien puede sobrescribir es justamente cómo una carta termina ofreciéndole gluten a un celíaco.",
    section: "admin" },
  "admin.english": { en: "English", es: "Inglés", section: "admin" },
  "admin.spanish": { en: "Spanish", es: "Español", section: "admin" },
  "admin.save": { en: "Save", es: "Guardar", section: "admin" },
  "admin.saved": { en: "Saved", es: "Guardado", section: "admin" },
  "admin.needsSpanish": {
    en: "The Spanish cannot be empty. Every string on this site exists in both languages, and a blank here is how that stops being true.",
    es: "El español no puede quedar vacío. Toda cadena de este sitio existe en ambos idiomas, y dejarlo en blanco es justo cómo eso deja de ser cierto.",
    section: "admin" },
  "admin.derived": {
    en: "Read from the recipe — not editable here",
    es: "Se lee de la receta — no editable aquí", section: "admin" },
  "admin.revertToCode": { en: "back to the default", es: "volver al valor por defecto", section: "admin" },

  /* ── accounts ── */
  "nav.account": { en: "Account", es: "Cuenta", section: "nav" },
  "account.heading": { en: "Your account", es: "Su cuenta", section: "account" },
  "account.lede": {
    en: "Change your password. It is the only thing between the cost of 223 dishes and anybody who asks.",
    es: "Cambie su contraseña. Es lo único entre el costo de 223 platos y cualquiera que pregunte.",
    section: "account" },
  "account.current": { en: "Current password", es: "Contraseña actual", section: "account" },
  "account.new": { en: "New password", es: "Contraseña nueva", section: "account" },
  "account.confirm": { en: "New password again", es: "Repita la contraseña nueva", section: "account" },
  "account.change": { en: "Change it", es: "Cambiarla", section: "account" },
  "account.changed": { en: "Changed.", es: "Cambiada.", section: "account" },
  "account.minimum": {
    en: "Twelve characters minimum.",
    es: "Mínimo doce caracteres.", section: "account" },
  "account.mismatch": {
    en: "The two new passwords are not the same.",
    es: "Las dos contraseñas nuevas no coinciden.", section: "account" },

  "admin.logins": { en: "Logins", es: "Accesos", section: "admin" },
  "admin.loginsLede": {
    en: "Every account, and the two things you can do to one: switch it off, or hand its owner a link to set a new password. There is no email here — send the link over WhatsApp, the way you sent the first one.",
    es: "Cada cuenta, y las dos cosas que puede hacer con una: desactivarla, o entregar a su dueño un enlace para poner una contraseña nueva. Aquí no hay correo — envíe el enlace por WhatsApp, como envió el primero.",
    section: "admin" },
  "admin.issueReset": { en: "New password link", es: "Enlace de contraseña", section: "admin" },
  "admin.resetIssued": {
    en: "Copy this now. It is shown once, it works for one hour, and it cannot be shown again.",
    es: "Cópielo ahora. Se muestra una vez, sirve por una hora y no se puede volver a mostrar.",
    section: "admin" },
  "admin.switchOff": { en: "Switch off", es: "Desactivar", section: "admin" },
  "admin.switchOn": { en: "Switch on", es: "Activar", section: "admin" },
  "admin.accountOff": { en: "switched off", es: "desactivada", section: "admin" },
  "admin.noPassword": { en: "no password set", es: "sin contraseña", section: "admin" },

  "reset.heading": { en: "Set a new password", es: "Ponga una contraseña nueva", section: "reset" },
  "reset.for": { en: "For", es: "Para", section: "reset" },
  "reset.set": { en: "Set it", es: "Ponerla", section: "reset" },
  "reset.gone": {
    en: "That link has expired or has already been used. Ask for another.",
    es: "Ese enlace venció o ya se usó. Pida otro.", section: "reset" },
  "reset.done": {
    en: "Done. Sign in with the new password.",
    es: "Listo. Entre con la contraseña nueva.", section: "reset" },

  /* ── can you do the 14th? ── */
  "take.heading": { en: "Can you do it?", es: "¿Puede tomarlo?", section: "take" },
  "take.lede": {
    en: "Somebody is on the phone with a date. Put it in and find out whether it fits beside what you have already sold that day — before you say yes.",
    es: "Alguien está al teléfono con una fecha. Póngala y vea si entra junto a lo que ya vendió ese día — antes de decir que sí.",
    section: "take" },
  "take.date": { en: "Date", es: "Fecha", section: "take" },
  "take.guests": { en: "Guests", es: "Invitados", section: "take" },
  "take.tier": { en: "Tier", es: "Nivel", section: "take" },
  "take.district": { en: "District", es: "Distrito", section: "take" },
  "take.venue": { en: "Venue", es: "Local", section: "take" },
  "take.time": { en: "On the table at", es: "En la mesa a las", section: "take" },
  "take.hours": { en: "Service runs", es: "El servicio dura", section: "take" },
  "take.ask": { en: "Ask", es: "Preguntar", section: "take" },
  "take.yes": { en: "Yes — it fits.", es: "Sí — entra.", section: "take" },
  "take.no": { en: "No, not as it stands.", es: "No, así no.", section: "take" },
  "take.against": { en: "checked against", es: "comparado con", section: "take" },
  "take.alone": {
    en: "Nothing else is on that day.",
    es: "No hay nada más ese día.", section: "take" },
  "take.kit": { en: "What you have", es: "Con lo que cuenta", section: "take" },
  "take.planchas": { en: "Planchas", es: "Planchas", section: "take" },
  "take.fryers": { en: "Fryers", es: "Freidoras", section: "take" },
  "take.ovens": { en: "Ovens", es: "Hornos", section: "take" },
  "take.vans": { en: "Vans", es: "Camionetas", section: "take" },
  "take.crew": { en: "Crew", es: "Personal", section: "take" },
  "take.book": { en: "Put it in the book", es: "Ponerlo en la agenda", section: "take" },
  "nav.take": { en: "Can you do it?", es: "¿Puede tomarlo?", section: "nav" },

  /* ── price drift ── */
  "drift.heading": { en: "What is moving", es: "Lo que se está moviendo", section: "drift" },
  "drift.lede": {
    en: "Every ingredient you have priced more than once, and what has happened since. A supplier who creeps up 4% a month is invisible one receipt at a time.",
    es: "Cada ingrediente que ha registrado más de una vez, y lo que ha pasado desde entonces. Un proveedor que sube 4% al mes es invisible boleta por boleta.",
    section: "drift" },
  "drift.since": { en: "since", es: "desde", section: "drift" },
  "drift.readings": { en: "readings", es: "registros", section: "drift" },
  "drift.settled": {
    en: "Nothing has moved more than 5%.",
    es: "Nada se ha movido más de 5%.", section: "drift" },
  "drift.needTwo": {
    en: "Price something twice and this page starts answering.",
    es: "Registre un precio dos veces y esta página empieza a responder.", section: "drift" },
  "drift.dishes": { en: "dishes carry it", es: "platos lo llevan", section: "drift" },
  "drift.overEstimate": { en: "over the estimate", es: "sobre el estimado", section: "drift" },
  "drift.underEstimate": { en: "under the estimate", es: "bajo el estimado", section: "drift" }
};

/** A phrase book for one render: the defaults, with any saved rows over them. */
export type CopyBook = (key: string) => string;

export async function loadCopy(locale: Locale): Promise<CopyBook> {
  let saved: Record<string, { en: string; es: string }> = {};
  try {
    const rows = await db.select().from(siteCopy);
    saved = Object.fromEntries(rows.map((r) => [r.key, { en: r.en, es: r.es }]));
  } catch {
    // No database yet, or it is asleep. The code defaults are a complete set,
    // so the page renders correctly rather than not at all.
  }

  return (key: string) => {
    const row = saved[key] ?? COPY[key];
    if (!row) {
      // A missing key is a bug, not a blank. Say so loudly enough to notice in
      // development; __tests__/copy.test.ts turns it into a failing build.
      return `⟨${key}⟩`;
    }
    return locale === "es" ? row.es : row.en;
  };
}

/** The defaults alone, for code paths with no database in reach. */
export function staticCopy(locale: Locale): CopyBook {
  return (key: string) => {
    const row = COPY[key];
    return row ? (locale === "es" ? row.es : row.en) : `⟨${key}⟩`;
  };
}
