import type { Localized } from "./catalog";

/**
 * Frequently asked questions.
 *
 * Ordered by where a buyer is in their decision: how to start, what to have
 * ready, what is included, then logistics. Each answer leads with the direct
 * answer in its first sentence — that is what gets quoted in search results and
 * what a person skimming on a phone actually reads.
 *
 * No answer promises a response time, a price or a stock level. Those are the
 * business's to state, and a promise on a website that the phone line cannot
 * keep costs more trust than it earns.
 */

export interface Faq {
  question: Localized;
  answer: Localized;
}

export const FAQS: Faq[] = [
  {
    question: {
      en: "How do I rent equipment from you?",
      ar: "كيف أستأجر معدة منكم؟",
    },
    answer: {
      en: "Call us, message us on WhatsApp or send the quote request form. Tell us the machine or the job, where the site is, when you need it and for how long. We confirm availability and send you a quote, then arrange delivery once you accept it.",
      ar: "اتصل بنا أو راسلنا عبر واتساب أو أرسل نموذج طلب عرض السعر. أخبرنا بالمعدة أو طبيعة العمل، وموقع المشروع، وموعد الحاجة إليها ومدتها. نؤكد التوفر ونرسل لك عرض السعر، ثم نرتب التوصيل بعد موافقتك.",
    },
  },
  {
    question: {
      en: "What do you need to know to give me a quote?",
      ar: "ما المعلومات التي تحتاجونها لتقديم عرض سعر؟",
    },
    answer: {
      en: "Four things: the machine (or what you need it to do), the site location, the start date and how long you need it, and whether you need an operator. For crane work, the heaviest load, the lifting radius and the lift height help us suggest the right size.",
      ar: "أربعة أمور: المعدة (أو العمل المطلوب منها)، وموقع المشروع، وتاريخ البدء ومدة الإيجار، وهل تحتاج إلى مشغل. ولأعمال الرافعات، يساعدنا أثقل حمل ونصف قطر الرفع وارتفاعه على اقتراح الحجم المناسب.",
    },
  },
  {
    question: {
      en: "Do you supply an operator?",
      ar: "هل توفرون مشغلاً للمعدة؟",
    },
    answer: {
      en: "Yes. Cranes and larger machines are supplied with a certified operator, and smaller machines such as forklifts, scissor lifts and excavators can be rented with or without one. Each equipment page states which applies.",
      ar: "نعم. تُوفَّر الرافعات والمعدات الكبيرة مع مشغل معتمد، ويمكن استئجار المعدات الأصغر مثل الرافعات الشوكية والرافعات المقصية والحفارات مع مشغل أو بدونه. توضح كل صفحة معدة الحالة التي تنطبق عليها.",
    },
  },
  {
    question: {
      en: "Is fuel included?",
      ar: "هل الوقود مشمول؟",
    },
    answer: {
      en: "Usually not. Most machines are rented dry, meaning you supply the fuel, and each equipment page lists what is and is not included. Your quote states it in writing, so there is no surprise on the invoice.",
      ar: "عادةً لا. تُؤجَّر معظم المعدات بدون وقود، أي أنك توفّر الوقود، وتوضح كل صفحة معدة ما هو مشمول وما هو غير مشمول. ويذكر عرض السعر ذلك كتابةً حتى لا تكون هناك مفاجآت في الفاتورة.",
    },
  },
  {
    question: {
      en: "Do you deliver to site?",
      ar: "هل توصلون المعدة إلى الموقع؟",
    },
    answer: {
      en: "Yes. Delivery to your site and collection at the end of the rental are arranged with the machine and priced in your quote, based on the distance and the size of the machine. Heavy machines travel on a low-bed trailer, with escort vehicles where the load requires them.",
      ar: "نعم. يُرتَّب توصيل المعدة إلى موقعك واستلامها في نهاية الإيجار، ويُسعَّر ذلك في عرض السعر بحسب المسافة وحجم المعدة. تُنقل المعدات الثقيلة على مقطورة منخفضة، مع مركبات مرافقة عندما تتطلب الحمولة ذلك.",
    },
  },
  {
    question: {
      en: "Can I rent by the day, week or month?",
      ar: "هل يمكن الاستئجار باليوم أو الأسبوع أو الشهر؟",
    },
    answer: {
      en: "Yes. Rentals are available by the day, week or month, and longer rentals are quoted on project terms. Some large machines have a minimum period because of the cost of moving them to site.",
      ar: "نعم. يتوفر الإيجار باليوم أو الأسبوع أو الشهر، وتُسعَّر الإيجارات الأطول وفق شروط المشروع. وبعض المعدات الكبيرة لها حد أدنى لمدة الإيجار بسبب تكلفة نقلها إلى الموقع.",
    },
  },
  {
    question: {
      en: "How far ahead should I get in touch?",
      ar: "كم من الوقت مسبقاً يجب أن أتواصل معكم؟",
    },
    answer: {
      en: "As early as you can. Large cranes and any load that needs a route survey or road permits need the most planning, so allow two to four weeks for those. For standard machines, contact us as soon as your dates are known.",
      ar: "في أقرب وقت ممكن. تحتاج الرافعات الكبيرة وأي حمولة تتطلب دراسة مسار أو تصاريح طرق إلى أطول فترة تخطيط، لذا خصص لها من أسبوعين إلى أربعة أسابيع. وبالنسبة للمعدات القياسية، تواصل معنا بمجرد تحديد مواعيدك.",
    },
  },
  {
    question: {
      en: "Who is responsible for the lift plan and site preparation?",
      ar: "من المسؤول عن خطة الرفع وتجهيز الموقع؟",
    },
    answer: {
      en: "The site. A lift plan and method statement by a competent person, ground bearing assessment, permits and safe access for the machine are the responsibility of the party running the work. We supply the equipment, and the operator where one is included, and we are glad to talk through what a lift needs.",
      ar: "الجهة المنفذة للعمل. فخطة الرفع وبيان الطريقة من شخص مؤهل، وتقييم تحمل التربة، والتصاريح، وتأمين وصول آمن للمعدة هي مسؤولية الجهة التي تدير العمل. نحن نوفر المعدة والمشغل عندما يكون مشمولاً، ويسعدنا مناقشة متطلبات عملية الرفع معك.",
    },
  },
];
