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
  "nav.home": { en: "Panel", es: "Panel", section: "nav" },
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
  "drift.underEstimate": { en: "under the estimate", es: "bajo el estimado", section: "drift" },

  /* ── what sells against what it earns ── */
  "nav.engineering": { en: "What sells", es: "Qué se vende", section: "nav" },
  "eng.heading": { en: "What sells, against what it earns", es: "Qué se vende, contra lo que deja", section: "eng" },
  "eng.lede": {
    en: "Popularity from the quotes you won. Margin from the recipe, priced with what you actually paid at the market. Almost no kitchen can put these two numbers beside each other, because they normally live in two systems that have never spoken.",
    es: "Popularidad de las cotizaciones ganadas. Margen de la receta, costeada con lo que pagó de verdad en el mercado. Casi ninguna cocina puede poner estos dos números juntos, porque suelen vivir en dos sistemas que nunca se han hablado.",
    section: "eng" },
  "eng.nothingYet": {
    en: "Nothing has been won yet. Mark a quote won and this page starts answering.",
    es: "Todavía no hay nada ganado. Marque una cotización como ganada y esta página empieza a responder.",
    section: "eng" },
  "eng.covers": { en: "covers", es: "cubiertos", section: "eng" },
  "eng.quotes": { en: "quotes", es: "cotizaciones", section: "eng" },
  "eng.margin": { en: "per cover", es: "por cubierto", section: "eng" },
  "eng.contribution": { en: "earned", es: "ganado", section: "eng" },
  "eng.bleeding": { en: "Selling well, costing too much", es: "Se vende bien, cuesta demasiado", section: "eng" },
  "eng.bleedingLede": {
    en: "Popular and over the food-cost target. Every extra one you sell makes this bigger — it is the sharpest thing on this page.",
    es: "Populares y por encima del costo objetivo. Cada uno más que vende lo agranda — es lo más urgente de esta página.",
    section: "eng" },
  "eng.neverQuoted": { en: "Never offered", es: "Nunca ofrecidos", section: "eng" },
  "eng.neverQuotedLede": {
    en: "Not dogs. Nobody has put these in front of a client yet, which is a different sentence entirely — and a menu decision taken on the wrong one removes a dish that was never given a chance.",
    es: "No son perros. Nadie los ha puesto delante de un cliente todavía, que es una frase completamente distinta — y una decisión tomada sobre la equivocada quita un plato que nunca tuvo oportunidad.",
    section: "eng" },

  /* ── the menu that proposes itself ── */
  "nav.propose": { en: "Propose a menu", es: "Proponer un menú", section: "nav" },
  "propose.heading": { en: "Propose a menu", es: "Proponer un menú", section: "propose" },
  "propose.lede": {
    en: "Six questions at once, which is what you ask yourself when somebody rings. Legal to sell this month, in season, inside the food-cost target, safe for this client, cookable with the kit you own, and Scottish above half.",
    es: "Seis preguntas a la vez, que es lo que uno se pregunta cuando alguien llama. Legal de vender este mes, de temporada, dentro del costo objetivo, seguro para este cliente, cocinable con el equipo que tiene, y escocés más de la mitad.",
    section: "propose" },
  "propose.month": { en: "Month", es: "Mes", section: "propose" },
  "propose.client": { en: "Client", es: "Cliente", section: "propose" },
  "propose.noClient": { en: "Nobody in particular", es: "Nadie en particular", section: "propose" },
  "propose.dishes": { en: "Dishes", es: "Platos", section: "propose" },
  "propose.kit": { en: "Kit on the day", es: "Equipo del día", section: "propose" },
  "propose.go": { en: "Propose", es: "Proponer", section: "propose" },
  "propose.why": { en: "Why each one is here", es: "Por qué está cada uno", section: "propose" },
  "propose.rejected": { en: "What the month took away", es: "Lo que se llevó el mes", section: "propose" },
  "propose.rejectedLede": {
    en: "Shown as prominently as the menu. A proposal that cannot say what it ruled out is worth nothing to somebody about to send it to a client.",
    es: "Se muestra tan visible como el menú. Una propuesta que no puede decir qué descartó no sirve de nada a quien está por enviarla a un cliente.",
    section: "propose" },
  "propose.british": { en: "British", es: "británico", section: "propose" },
  "propose.draft": {
    en: "A first draft by something that has read all 223. You still sign it.",
    es: "Un primer borrador de algo que ha leído los 223. Usted sigue firmándolo.",
    section: "propose" },
  "propose.diets": { en: "Diets on record", es: "Dietas registradas", section: "propose" },
  "propose.foodCost": { en: "food cost", es: "costo", section: "propose" },
  "propose.perGuest": { en: "per guest, ex-IGV", es: "por invitado, sin IGV", section: "propose" },

  /* ───────────── the shop window: everything a stranger sees ───────────── */

  "pub.navMenu": { en: "The menu", es: "La carta", section: "public" },
  "pub.navPackages": { en: "Packages", es: "Paquetes", section: "public" },
  "pub.navEvents": { en: "Events", es: "Eventos", section: "public" },
  "pub.navSignIn": { en: "Sign in", es: "Entrar", section: "public" },

  "pub.tagline": {
    en: "Scottish-Peruvian catering · Lima",
    es: "Catering escocés-peruano · Lima", section: "public" },
  "pub.hero": {
    en: "Aye is Scottish for yes. Sí is Spanish for yes. Say it aloud and it means something else again.",
    es: "Aye es «sí» en escocés. Sí es «sí» en español. Dígalo en voz alta y significa otra cosa.",
    section: "public" },
  "pub.heroLede": {
    en: "Glasgow technique, run through the Lima pantry. Canapés, buffets and plated dinners for events anywhere in Lima.",
    es: "Técnica de Glasgow, hecha con la despensa limeña. Canapés, bufés y cenas montadas para eventos en toda Lima.",
    section: "public" },
  "pub.seeMenu": { en: "See the menu", es: "Ver la carta", section: "public" },
  "pub.seePackages": { en: "What it costs", es: "Cuánto cuesta", section: "public" },
  "pub.whatsapp": { en: "Ask on WhatsApp", es: "Preguntar por WhatsApp", section: "public" },
  "pub.dishes": { en: "dishes", es: "platos", section: "public" },

  "pub.menuHeading": { en: "The menu", es: "La carta", section: "public" },
  "pub.menuLede": {
    en: "Every dish, with what is in it and who can eat it. Filter by the diet you need to cater for — the answer comes from the recipe itself, not from a label somebody typed.",
    es: "Cada plato, con lo que lleva y quién puede comerlo. Filtre por la dieta que necesita — la respuesta sale de la receta misma, no de una etiqueta que alguien escribió.",
    section: "public" },
  "pub.menuPricesNote": {
    en: "Prices are quoted per event, not per dish — the district, the hour and the number of guests all move them. The packages page has a per-guest figure to start from.",
    es: "Los precios se cotizan por evento, no por plato — el distrito, la hora y el número de invitados los mueven. En paquetes hay una cifra por invitado para empezar.",
    section: "public" },

  "pub.pkgHeading": { en: "What it costs", es: "Cuánto cuesta", section: "public" },
  "pub.pkgLede": {
    en: "Five levels of service from one kitchen — a children's party at one end, a tasting menu with a canapé reception at the other. The ranges include IGV and come from real menus priced at each tier. The final number depends on what you choose, the district, the hour and the guest count.",
    es: "Cinco niveles de servicio desde una sola cocina — una fiesta infantil en un extremo, un menú degustación con recepción de canapés en el otro. Los rangos incluyen IGV y salen de menús reales costeados en cada nivel. El número final depende de lo que elija, el distrito, la hora y la cantidad de invitados.",
    section: "public" },
  "pub.pkgFrom": { en: "from", es: "desde", section: "public" },
  "pub.pkgPerGuest": { en: "per guest, IGV included", es: "por invitado, IGV incluido", section: "public" },
  "pub.pkgTypical": { en: "most events", es: "la mayoría de los eventos", section: "public" },
  "pub.pkgTo": { en: "to", es: "a", section: "public" },
  "pub.pkgMinimum": { en: "Minimum", es: "Mínimo", section: "public" },
  "pub.pkgGuests": { en: "guests", es: "invitados", section: "public" },
  "pub.pkgAvailable": { en: "dishes at this tier", es: "platos en este nivel", section: "public" },
  "pub.pkgLicence": {
    en: "Selling alcohol at your event needs the giro especial. Cooking with it does not — ask and we will tell you which yours is.",
    es: "Vender alcohol en su evento requiere el giro especial. Cocinar con alcohol no — pregúntenos y le decimos cuál es su caso.",
    section: "public" },

  "pub.eventsHeading": { en: "By the moment", es: "Por el momento", section: "public" },
  "pub.eventsLede": {
    en: "An arrival canapé and a late-night bite are not the same job. Pick the moment and see what actually works for it — one hand holding a drink, no cutlery, off a tray, at midnight.",
    es: "Un canapé de bienvenida y un bocado de medianoche no son el mismo trabajo. Elija el momento y vea qué funciona de verdad — con una mano ocupada, sin cubiertos, en bandeja, a medianoche.",
    section: "public" },

  "pub.allergens": { en: "Allergies and diets", es: "Alergias y dietas", section: "public" },
  "pub.allergensLede": {
    en: "Every allergen shown on this site is read off the recipe by the same engine that prints the kitchen's own sheets. It is not a legal allergen audit — tell us what you need and we will confirm it in writing before the date.",
    es: "Cada alérgeno de este sitio se lee de la receta con el mismo motor que imprime las hojas de la cocina. No es una auditoría legal de alérgenos — dígannos qué necesitan y lo confirmamos por escrito antes de la fecha.",
    section: "public" },
  "pub.contact": { en: "Ask us", es: "Escríbanos", section: "public" },
  "pub.contactLede": {
    en: "Tell us the date, the district and roughly how many. We will come back with a menu and a number.",
    es: "Díganos la fecha, el distrito y más o menos cuántos. Le respondemos con un menú y un precio.",
    section: "public" },
  "pub.search": { en: "Search", es: "Buscar", section: "public" },
  "pub.searchHint": {
    en: "a dish, an ingredient, a hometown…",
    es: "un plato, un ingrediente, un origen…", section: "public" },
  "pub.of": { en: "of", es: "de", section: "public" },
  "pub.course": { en: "Course", es: "Tiempo", section: "public" },
  "pub.diets": { en: "Diets", es: "Dietas", section: "public" },
  "pub.clear": { en: "Clear all", es: "Limpiar todo", section: "public" },
  "pub.nothing": {
    en: "Nothing matches all of that. Loosen one filter — or ask us, because a dish can usually be adapted.",
    es: "Nada coincide con todo eso. Suelte un filtro — o pregúntenos, porque casi siempre se puede adaptar un plato.",
    section: "public" },
  "pub.contains": { en: "Contains", es: "Contiene", section: "public" },
  "pub.noneDeclarable": {
    en: "None of the 14 declarable allergens",
    es: "Ninguno de los 14 alérgenos declarables", section: "public" },
  "pub.licence": { en: "Alcohol — licence applies", es: "Alcohol — aplica licencia", section: "public" },


  /* ── the two label sets that were English-only ── */

  "cat.canape": { en: "Canapés & bites", es: "Canapés y bocados", section: "labels" },
  "cat.main": { en: "Mains", es: "Platos de fondo", section: "labels" },
  "cat.side": { en: "Sides & breads", es: "Guarniciones y panes", section: "labels" },
  "cat.bowl": { en: "Bowls", es: "Bowls", section: "labels" },
  "cat.breakfast": { en: "Breakfast", es: "Desayunos", section: "labels" },
  "cat.bakery": { en: "Bakery", es: "Panadería y pastelería", section: "labels" },
  "cat.dessert": { en: "Desserts", es: "Postres", section: "labels" },

  "diet.vegetarian": { en: "Vegetarian", es: "Vegetariano", section: "labels" },
  "diet.vegan": { en: "Vegan", es: "Vegano", section: "labels" },
  "diet.pescatarian": { en: "Pescatarian", es: "Pescetariano", section: "labels" },
  "diet.glutenFree": { en: "Coeliac / gluten-free", es: "Celíaco / sin gluten", section: "labels" },
  "diet.dairyFree": { en: "Lactose / dairy-free", es: "Sin lactosa / sin lácteos", section: "labels" },
  "diet.nutFree": { en: "Nut-free", es: "Sin frutos secos", section: "labels" },
  "diet.noPork": { en: "No pork", es: "Sin cerdo", section: "labels" },
  "diet.noAlcohol": { en: "No alcohol", es: "Sin alcohol", section: "labels" },
  "diet.halalIngredients": { en: "Halal — ingredients only", es: "Halal — solo ingredientes", section: "labels" },
  "diet.kosherIngredients": { en: "Kosher — ingredients only", es: "Kosher — solo ingredientes", section: "labels" },
  "diet.lowFodmap": { en: "Low FODMAP", es: "Bajo en FODMAP", section: "labels" },
  "diet.lowerCarb": { en: "Lower carb / keto-leaning", es: "Bajo en carbohidratos / keto", section: "labels" },
  "diet.lowerSugar": { en: "Lower sugar", es: "Bajo en azúcar", section: "labels" },
  "diet.kidFriendly": { en: "Children", es: "Para niños", section: "labels" },
  "diet.softTexture": { en: "Soft texture", es: "Textura suave", section: "labels" },


  /* The EU 14, plus pork and alcohol. Safety labels, so both languages. */
  "allg.gluten": { en: "Gluten", es: "Gluten", section: "labels" },
  "allg.crustaceans": { en: "Crustaceans", es: "Crustáceos", section: "labels" },
  "allg.eggs": { en: "Eggs", es: "Huevo", section: "labels" },
  "allg.fish": { en: "Fish", es: "Pescado", section: "labels" },
  "allg.peanuts": { en: "Peanuts", es: "Maní", section: "labels" },
  "allg.soya": { en: "Soya", es: "Soya", section: "labels" },
  "allg.milk": { en: "Milk", es: "Leche", section: "labels" },
  "allg.nuts": { en: "Tree nuts", es: "Frutos secos", section: "labels" },
  "allg.celery": { en: "Celery", es: "Apio", section: "labels" },
  "allg.mustard": { en: "Mustard", es: "Mostaza", section: "labels" },
  "allg.sesame": { en: "Sesame", es: "Ajonjolí", section: "labels" },
  "allg.sulphites": { en: "Sulphites", es: "Sulfitos", section: "labels" },
  "allg.lupin": { en: "Lupin", es: "Altramuz / chocho", section: "labels" },
  "allg.molluscs": { en: "Molluscs", es: "Moluscos", section: "labels" },
  "allg.pork": { en: "Pork", es: "Cerdo", section: "labels" },
  "allg.alcohol": { en: "Alcohol", es: "Alcohol", section: "labels" },

  /* ── what a scan lands on ── */
  "dish.declares": { en: "What is in this", es: "Qué lleva esto", section: "public" },
  "dish.contains": { en: "Contains", es: "Contiene", section: "public" },
  "dish.containsNone": {
    en: "None of the 14 declarable allergens",
    es: "Ninguno de los 14 alérgenos declarables", section: "public" },
  "dish.suits": { en: "Suitable for", es: "Apto para", section: "public" },
  "dish.made": { en: "Made from", es: "Hecho con", section: "public" },
  "dish.readFromRecipe": {
    en: "Read off the recipe by the same engine that prints the kitchen's own sheets. Nobody types this card, which is the point of it.",
    es: "Leído de la receta por el mismo motor que imprime las hojas de la cocina. Nadie escribe esta ficha a mano, y ese es el punto.",
    section: "public" },
  "dish.notAnAudit": {
    en: "This is not a legal allergen audit. We cook in one kitchen, so we cannot promise a dish has never been near an ingredient that is not listed. If somebody at your table reacts severely, tell us before the date and we will handle it separately.",
    es: "Esto no es una auditoría legal de alérgenos. Cocinamos en una sola cocina, así que no podemos prometer que un plato nunca estuvo cerca de un ingrediente que no figura. Si alguien en su mesa reacciona de forma severa, avísenos antes de la fecha y lo manejamos aparte.",
    section: "public" },
  "dish.backToMenu": { en: "The whole menu", es: "La carta completa", section: "public" },
  "dish.licence": {
    en: "Contains alcohol.", es: "Contiene alcohol.", section: "public" },

  /* ── the printable label sheet ── */
  "labels.heading": { en: "Box labels", es: "Etiquetas de caja", section: "labels" },
  "labels.lede": {
    en: "One label per dish. The code resolves to the allergen declaration, generated from the recipe — so the card on the box cannot disagree with the food in it. Print, cut, stick.",
    es: "Una etiqueta por plato. El código lleva a la declaración de alérgenos, generada desde la receta — así la ficha de la caja no puede contradecir la comida que lleva. Imprima, corte, pegue.",
    section: "labels" },
  "labels.print": { en: "Print", es: "Imprimir", section: "labels" },
  "labels.forEvent": { en: "For a booking", es: "Para una reserva", section: "labels" },
  "labels.wholeMenu": { en: "The whole menu", es: "La carta completa", section: "labels" },
  "labels.scanToRead": { en: "Scan to read", es: "Escanee para leer", section: "labels" },
  "nav.labels": { en: "Box labels", es: "Etiquetas", section: "nav" },

  "pub.staffOnly": {
    en: "Costs, recipes and quotes are behind the sign-in.",
    es: "Costos, recetas y cotizaciones están detrás del acceso.", section: "public" }
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
/**
 * The two label sets that were English only.
 *
 * CATEGORY_LABEL and DIET_LABEL have lived in lib/dishes.ts and lib/dietary.ts
 * since the beginning, in English, and every page rendered them as-is. Nobody
 * noticed because the pages around them were English too — until a Spanish shop
 * window put "Canapés & bites" and "Coeliac / gluten-free" under a Spanish
 * heading, for customers in Lima.
 *
 * The English records stay where they are: they are the code default and the
 * fallback, and the standalone build reads them directly. These helpers look
 * the phrase up in the copy book first, so both languages are enforced by the
 * same test as everything else — and so the owner can reword "Guarniciones y
 * panes" in the admin without a deploy.
 */
const camel = (id: string) =>
  id.split("-").map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1))).join("");

export const categoryLabel = (t: CopyBook, id: string, fallback: string) =>
  resolve(t, `cat.${camel(id)}`, fallback);

export const dietLabel = (t: CopyBook, id: string, fallback: string) =>
  resolve(t, `diet.${camel(id)}`, fallback);

/**
 * The EU 14 declarable allergens, plus pork and alcohol.
 *
 * These matter more than the other two label sets. A guest scanning a menu for
 * "APIO" and reading "CELERY" has not been told anything, and celery is on the
 * list precisely because it puts people in hospital.
 */
export const allergenLabel = (t: CopyBook, id: string, fallback: string) =>
  resolve(t, `allg.${camel(id)}`, fallback);

/** A missing key renders ⟨key⟩; for a label, the English is a better answer. */
function resolve(t: CopyBook, key: string, fallback: string): string {
  const out = t(key);
  return out.startsWith("\u27E8") ? fallback : out;
}

export function staticCopy(locale: Locale): CopyBook {
  return (key: string) => {
    const row = COPY[key];
    return row ? (locale === "es" ? row.es : row.en) : `⟨${key}⟩`;
  };
}
