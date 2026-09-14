/**
 * English copy. The source of the `Dictionary` type: a key missing from the
 * Arabic dictionary is a compile error, not a blank on the page.
 *
 * Copy rules this file follows, so later edits keep to them:
 *  - Say what a button does ("Get a quote", "WhatsApp us"), never "Submit".
 *  - No response times, prices, stock levels, years or client names. Those are
 *    the business's to state; see content/business.ts.
 *  - Sentence case everywhere.
 */
export const en = {
  meta: {
    tagline: "Heavy equipment rental in Saudi Arabia",
    homeTitle: "Heavy Equipment Rental in Saudi Arabia | Cranes, Excavators, Forklifts",
    homeDescription:
      "Rent cranes, excavators, forklifts, manlifts, generators and low-bed trailers for construction and industrial sites in Riyadh, Jeddah and the Eastern Province. With or without operator.",
    equipmentTitle: "Equipment for Rent in Saudi Arabia",
    equipmentDescription:
      "Browse cranes, earthmoving machines, forklifts, access platforms, generators, pumps and trailers for rent. Specifications, what's included and quick quotes on WhatsApp.",
    contactTitle: "Contact Us for Equipment Rental Quotes",
    contactDescription:
      "Call, WhatsApp or send a quote request for heavy equipment rental. Tell us the machine, your site location and dates, and we'll confirm availability and a price.",
    aboutTitle: "About Us",
    aboutDescription:
      "Heavy equipment rental for construction and industrial sites in Saudi Arabia: the machines we supply, how rentals work and who is responsible for what on site.",
    guidesTitle: "Equipment Rental Guides",
    guidesDescription:
      "Practical guides to choosing and renting heavy equipment: crane sizing, mobile versus crawler cranes, and what a rental quote should include.",
    faqTitle: "Equipment Rental FAQ",
    faqDescription:
      "Answers to common questions about renting heavy equipment: operators, fuel, delivery to site, rental periods and what we need to give you a quote.",
    areasTitle: "Service Areas",
    areasDescription:
      "Heavy equipment rental delivered to construction and industrial sites in Riyadh, Jeddah, Dammam, Al Khobar and Jubail.",
    areaTitle: "Heavy Equipment Rental in {city}",
    areaDescription:
      "Rent cranes, excavators, forklifts, manlifts, generators and transport in {city}. With or without operator, delivered to your site. Call or WhatsApp for a quote.",
    categoryTitle: "{category} for Rent in Saudi Arabia",
    categoryDescription:
      "{category} for rent in Saudi Arabia. Compare specifications, see what's included, and get a quote by phone or WhatsApp. {summary}",
    machineTitle: "{machine} for Rent",
    machineDescription:
      "{machine} for rent in Saudi Arabia. {specs}. {operator}. Get a quote by phone or WhatsApp.",
    privacyTitle: "Privacy Policy",
    privacyDescription: "How this website handles information: no accounts, no tracking cookies, and a quote form that sends nothing until you press send in WhatsApp or email.",
    termsTitle: "Website Terms of Use",
    termsDescription: "Terms for using this website: equipment information and specifications, how quotes and rentals are agreed, and safety responsibilities.",
    creditsTitle: "Image Credits",
    creditsDescription: "Photographers and licences for the images used on this website.",
  },

  nav: {
    home: "Home",
    equipment: "Equipment",
    about: "About",
    contact: "Contact",
    guides: "Guides",
    faq: "FAQ",
    serviceAreas: "Service areas",
    primary: "Main",
    breadcrumb: "Breadcrumb",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    skipToContent: "Skip to content",
    switchLanguage: "العربية",
  },

  cta: {
    getQuote: "Get a quote",
    whatsapp: "WhatsApp us",
    chatOnWhatsapp: "Chat on WhatsApp",
    call: "Call",
    callNumber: "Call {number}",
    email: "Email us",
    browseEquipment: "Browse equipment",
    viewAllEquipment: "View all equipment",
    viewCategory: "View {category}",
    enquireNow: "Enquire now",
    rentThis: "Get a quote for this machine",
    whatsappMachine: "WhatsApp about this machine",
    readAllFaqs: "Read all questions",
    readAllGuides: "All guides",
  },

  /**
   * Prefilled WhatsApp and email text. Laid out as a short form the customer
   * completes in the chat, so the first message already carries what a quote
   * needs instead of starting a round of questions.
   */
  messages: {
    general: "Hello, I'd like a quote for equipment rental.\n\nEquipment:\nSite location:\nStart date:\nRental period:\nOperator needed:",
    machine: "Hello, I'd like a quote for the {machine}.\n\nSite location:\nStart date:\nRental period:\nOperator needed:",
    category: "Hello, I'd like a quote for {category}.\n\nSite location:\nStart date:\nRental period:\nOperator needed:",
    area: "Hello, I need equipment for a site in {city}.\n\nEquipment:\nStart date:\nRental period:\nOperator needed:",
    emailSubject: "Equipment rental enquiry",
    emailSubjectMachine: "Quote request: {machine}",
  },

  home: {
    heroTitle: "Heavy equipment rental in Saudi Arabia",
    heroSubtitle:
      "Cranes, excavators, forklifts, manlifts, generators and low-bed transport for construction and industrial sites in Riyadh, Jeddah and the Eastern Province.",
    heroFacts: ["With or without operator", "Delivered to your site", "Daily, weekly or monthly"],
    heroCallPrefix: "Or call",
    fleetLabel: "Equipment available to rent",
    categoriesTitle: "What do you need to rent?",
    categoriesIntro: "Choose a category to see the machines, their specifications and what each rental includes.",
    categoryMachines: "{count} machines",
    categoryMachine: "1 machine",
    howTitle: "How renting works",
    howIntro: "Three steps from finding the machine to having it on site.",
    steps: [
      {
        title: "Choose your equipment",
        body: "Browse by category, or just tell us the job. Not sure what size you need? Describe the lift or the work and we'll suggest options.",
      },
      {
        title: "Contact us",
        body: "Call, WhatsApp or send a quote request with your site location, dates and whether you need an operator.",
      },
      {
        title: "Get your rental arranged",
        body: "We confirm availability and send your quote. Once you accept, we arrange delivery to your site.",
      },
    ],
    whyTitle: "Why contractors rent from us",
    whyIntro: "What you can expect on every rental, whatever the size of the machine.",
    why: [
      {
        title: "Operators when you need them",
        body: "Cranes and larger machines come with a certified operator. Smaller machines can be rented with or without one.",
      },
      {
        title: "Transport arranged",
        body: "Delivery to site and collection at the end are organised with the rental, including low-bed trailers for heavy plant.",
      },
      {
        title: "Serviced during your rental",
        body: "Routine servicing is included on most machines while they're on hire. Each machine's page says whether it applies.",
      },
      {
        title: "Rental periods that fit the job",
        body: "Rent by the day, week or month. Longer projects are quoted on project terms.",
      },
      {
        title: "Clear about what's included",
        body: "Every machine lists what the rental includes and what it doesn't, and your quote states it in writing.",
      },
      {
        title: "Specifications in English and Arabic",
        body: "Every machine page, specification and guide on this site is written in both languages, so the whole team can read it.",
      },
    ],
    featuredTitle: "Featured equipment",
    featuredIntro: "A selection from across the range, from site forklifts to heavy lifting.",
    readyTitle: "Tell us what you need to lift, dig or move",
    readyBody: "Have these ready and we can quote without a round of questions:",
    readyChecklist: [
      "The machine, or the job it needs to do",
      "Site location and access",
      "Start date and how long you need it",
      "Whether you need an operator",
    ],
    areasTitle: "Where we work",
    areasIntro: "Equipment delivered to construction and industrial sites in these cities and the areas around them.",
    faqTitle: "Common questions",
    guidesTitle: "Guides for choosing equipment",
  },

  equipment: {
    indexTitle: "Equipment for rent",
    indexIntro:
      "Every machine below can be rented by the day, week or month. Open one to see its specifications and what the rental includes, then ask for a quote.",
    jumpTo: "Jump to a category",
    typicalModel: "Typical model",
    orEquivalent: "or equivalent",
    specifications: "Specifications",
    included: "Included in the rental",
    notIncluded: "Not included",
    operator: "Operator",
    operatorIncluded: "Supplied with a certified operator",
    operatorOptional: "Available with or without an operator",
    alsoKnownAs: "Also known as",
    inThisCategory: "Machines in this category",
    categoryHeading: "{category} for rent",
    otherInCategory: "Other {category}",
    otherCategories: "Other equipment",
    quoteTitle: "Get a quote for the {machine}",
    quoteBody: "Send us these details and we'll confirm availability and a price:",
    quoteChecklist: [
      "Site location",
      "Start date and rental period",
      "Operator needed or not",
    ],
    craneChecklist: "For crane work: the heaviest load, lifting radius and lift height",
    specsDisclaimer:
      "Specifications are typical for this class. The exact model supplied can vary; we confirm it with your quote.",
    relatedGuide: "Related guide",
    machinesCount: "{count} machines",
  },

  contact: {
    title: "Contact us to rent equipment",
    intro:
      "The quickest way to a quote is WhatsApp or a call. Tell us the machine, your site location and your dates.",
    whatsappTitle: "WhatsApp",
    whatsappBody: "Send the machine, site and dates in one message.",
    callTitle: "Call",
    callBody: "Talk it through, especially for crane lifts and larger jobs.",
    emailTitle: "Email",
    emailBody: "Best for drawings, lift details and tender documents.",
    hoursTitle: "Business hours",
    addressTitle: "Office",
    directions: "Get directions",
    areasTitle: "Service areas",
    formTitle: "Request a quote",
    formIntro: "Fill in what you know. Only your name and phone number are required.",
    fields: {
      name: "Your name",
      phone: "Phone number",
      company: "Company",
      equipment: "Equipment needed",
      equipmentNotSure: "Not sure — please advise",
      location: "Site location",
      locationHint: "City or area, for example Jubail Industrial City",
      startDate: "Start date",
      duration: "Rental period",
      durationHint: "For example 3 days, 2 weeks or 1 month",
      operator: "Operator needed?",
      operatorYes: "Yes",
      operatorNo: "No",
      operatorUnsure: "Not sure",
      message: "Anything else",
      messageHint: "Lift weights, access restrictions, working hours",
    },
    optional: "optional",
    sendWhatsapp: "Send on WhatsApp",
    sendEmail: "Send by email",
    formNote:
      "Your details open in WhatsApp or your email app, ready to send. Nothing is sent until you press send there.",
    errorName: "Enter your name so we know who to reply to.",
    errorPhone: "Enter a phone number we can call you back on.",
    errorSummary: "Please check the highlighted fields.",
    messageIntro: "Hello, I'd like a quote for equipment rental.",
    nextTitle: "What happens after you contact us",
    next: [
      "We check availability for your dates and ask anything a quote still needs.",
      "You receive a quote that states the rental, transport and what's included.",
      "Once you accept, we arrange delivery to your site.",
    ],
  },

  about: {
    title: "About us",
    lead:
      "We rent heavy equipment to construction and industrial sites in Saudi Arabia: cranes, earthmoving machines, forklifts, access platforms, power and pumping equipment, and the trailers to move them.",
    whatTitle: "What we supply",
    whatBody:
      "From a 3 tonne forklift to a 300 tonne crawler crane, every machine we list comes with its specifications and a plain statement of what the rental includes. Larger machines are supplied with a certified operator; smaller ones can be rented with or without.",
    howTitle: "How we work",
    howPoints: [
      "Quotes state the rental, transport and what is and isn't included, in writing.",
      "Machines are serviced during the rental period.",
      "Delivery and collection are arranged with the rental, including low-bed transport and escorts where a load needs them.",
      "Rentals run by the day, week or month.",
    ],
    safetyTitle: "Who is responsible for what on site",
    safetyIntro:
      "Heavy lifting and earthmoving work needs responsibilities to be clear before the machine arrives.",
    weProvideTitle: "We provide",
    weProvide: [
      "The equipment, serviced and in working order",
      "A certified operator where one is included in the rental",
      "Transport to and from site",
    ],
    youProvideTitle: "The site provides",
    youProvide: [
      "A lift plan and method statement by a competent person",
      "Ground bearing assessment and suitable ground for outriggers or tracks",
      "Permits, and road closures or escorts where required",
      "Safe access, and identification of underground services and overhead lines",
    ],
    registrationTitle: "Company details",
    foundedYear: "Operating since",
    crNumber: "Commercial registration",
    vatNumber: "VAT number",
    ctaTitle: "Need a machine on site?",
    ctaBody: "Tell us what you're working on and we'll help you choose the right equipment.",
  },

  areas: {
    title: "Service areas",
    intro:
      "We deliver equipment to construction and industrial sites in these cities and the areas around them. Working somewhere else? Ask us whether we can supply your site.",
    cityHeading: "Heavy equipment rental in {city}",
    cityIntro:
      "We supply cranes, excavators, forklifts, access platforms, generators and transport to construction and industrial sites in {city} and across {region}, including {nearby}.",
    equipmentInCity: "Equipment available in {city}",
    planningTitle: "Planning a rental in {city}",
    otherAreas: "Other service areas",
    enquire: "Get a quote for a site in {city}",
  },

  guides: {
    title: "Guides",
    intro: "Practical explanations to help you choose the right machine and understand a rental quote.",
    read: "Read the guide",
    updated: "Updated {date}",
    equipmentTitle: "Equipment in this guide",
  },

  faq: {
    title: "Frequently asked questions",
    intro: "Straight answers about renting equipment from us. Can't find yours? Ask us on WhatsApp.",
  },

  footer: {
    about: "Heavy equipment rental for construction and industrial sites in Saudi Arabia.",
    equipment: "Equipment",
    company: "Company",
    contact: "Contact",
    privacy: "Privacy policy",
    terms: "Terms of use",
    credits: "Image credits",
    rights: "All rights reserved.",
    crNumber: "CR",
    vatNumber: "VAT",
  },

  mobileBar: {
    label: "Contact options",
    call: "Call",
    whatsapp: "WhatsApp",
    quote: "Quote",
  },

  common: {
    home: "Home",
  },

  notFound: {
    title: "Page not found",
    body: "The page you're looking for isn't here. It may have moved when we reorganised the site.",
    home: "Go to the home page",
  },

  legal: {
    reviewNote: "Last updated {date}.",
  },

  credits: {
    title: "Image credits",
    intro:
      "Equipment photographs on this site are by the photographers below, used under the licences shown. They illustrate each class of machine and are not photographs of our own fleet.",
    by: "Photo by {author}",
    licence: "Licence",
    source: "Source",
    changes: "Cropped and resized.",
  },
};

export type Dictionary = DeepString<typeof en>;

/** Widens literal string types so the Arabic dictionary can supply its own text. */
type DeepString<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? DeepString<U>[]
    : { [K in keyof T]: DeepString<T[K]> };
