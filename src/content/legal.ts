import type { Localized } from "./catalog";

/**
 * Privacy policy and website terms.
 *
 * Written to describe what THIS site actually does, which is very little: no
 * accounts, no analytics or advertising cookies, and a quote form that sends
 * nothing to a server. A policy that describes data collection the site does
 * not perform is as misleading as one that omits collection it does.
 *
 * HAVE THESE REVIEWED by someone qualified in Saudi law (PDPL in particular)
 * before relying on them. They are an accurate plain-language starting point,
 * not legal advice. Markdown, rendered by lib/markdown.ts. {company} and
 * {email} are filled from content/business.ts.
 */

export const LEGAL_UPDATED = "2026-09-14";

export const PRIVACY: Localized = {
  en: `This policy explains what information this website handles and how {company} uses information you send us when you enquire about renting equipment.

## What this website collects

**No accounts and no online forms that submit to us.** The quote request form assembles your details in your own browser and opens WhatsApp or your email app with the message filled in. Nothing is sent to us, and nothing is stored by this website, until you choose to send that message yourself.

**One preference cookie.** If you switch the site's language, a small cookie remembers your choice for a year so the site opens in that language next time. It contains only "en" or "ar".

**No analytics or advertising cookies.** This site does not use tracking, advertising or third-party analytics cookies.

**Hosting.** Like any website, the servers that deliver these pages process technical information such as your IP address and browser type, to send you the page and to protect the site from abuse. The site is hosted by Vercel.

## When you contact us

If you contact us by WhatsApp, phone or email, we receive what you send: typically your name, phone number, company, site location and rental requirements. We use it to answer your enquiry, prepare a quote and arrange any rental you go ahead with.

Messages sent through WhatsApp or email are also processed by those services under their own privacy policies.

We keep enquiry correspondence for as long as we need it to respond, and afterwards only as long as business record-keeping or the law requires.

## Your rights

Under Saudi Arabia's Personal Data Protection Law you can ask us what personal information we hold about you, and ask us to correct or delete it. Email {email} and we will respond.

## Changes

If this policy changes, the updated version will be published on this page with a new date.`,
  ar: `توضح هذه السياسة المعلومات التي يتعامل معها هذا الموقع، وكيف تستخدم {company} المعلومات التي ترسلها إلينا عند استفسارك عن استئجار المعدات.

## ما يجمعه هذا الموقع

**لا حسابات ولا نماذج إلكترونية تُرسل إلينا.** يجمّع نموذج طلب عرض السعر بياناتك داخل متصفحك، ثم يفتح واتساب أو تطبيق البريد الإلكتروني والرسالة معبأة. لا يُرسل إلينا شيء ولا يخزن هذا الموقع أي شيء إلى أن تختار إرسال تلك الرسالة بنفسك.

**ملف تعريف ارتباط واحد للتفضيل.** إذا غيّرت لغة الموقع، يحفظ ملف تعريف ارتباط صغير اختيارك لمدة عام ليُفتح الموقع بتلك اللغة في المرة القادمة. ولا يحتوي إلا على "en" أو "ar".

**لا ملفات تعريف ارتباط للتحليلات أو الإعلانات.** لا يستخدم هذا الموقع ملفات تعريف ارتباط للتتبع أو الإعلانات أو التحليلات من جهات خارجية.

**الاستضافة.** كما هو الحال في أي موقع إلكتروني، تعالج الخوادم التي تقدم هذه الصفحات معلومات تقنية مثل عنوان IP ونوع المتصفح، لإرسال الصفحة إليك وحماية الموقع من إساءة الاستخدام. يُستضاف الموقع لدى Vercel.

## عند تواصلك معنا

إذا تواصلت معنا عبر واتساب أو الهاتف أو البريد الإلكتروني، نستلم ما ترسله: عادةً اسمك ورقم هاتفك وشركتك وموقع المشروع ومتطلبات الإيجار. ونستخدمها للرد على استفسارك وإعداد عرض السعر وترتيب أي إيجار تقرر المضي فيه.

كما تعالج خدمات واتساب والبريد الإلكتروني الرسائل المرسلة عبرها وفق سياسات الخصوصية الخاصة بها.

نحتفظ بمراسلات الاستفسار طالما احتجنا إليها للرد، وبعد ذلك فقط للمدة التي تتطلبها السجلات التجارية أو الأنظمة.

## حقوقك

بموجب نظام حماية البيانات الشخصية في المملكة العربية السعودية، يحق لك أن تسألنا عن المعلومات الشخصية التي نحتفظ بها عنك، وأن تطلب تصحيحها أو حذفها. راسلنا على {email} وسنرد عليك.

## التغييرات

إذا تغيرت هذه السياسة، ستُنشر النسخة المحدثة في هذه الصفحة بتاريخ جديد.`,
};

export const TERMS: Localized = {
  en: `These terms apply to your use of this website, operated by {company}.

## Information on this website

Equipment descriptions and specifications are provided for general guidance. Specifications are typical for each class of machine; the exact make and model supplied can vary and will be confirmed in your quote. Photographs illustrate each type of machine and are not necessarily of the unit you will receive. Photographers and licences are listed on the image credits page.

We aim to keep this information accurate and up to date, but it may change without notice.

## Quotes and rentals

No rental contract is formed through this website. A rental is agreed only through a written quote and rental agreement, and those documents set out the price, what is included, and the terms that apply.

## Safety and suitability

Guides and equipment information on this site are not a lift plan, a method statement or engineering advice. The suitability of any machine for a particular task, ground conditions and lifting operations must be confirmed by competent people who have assessed the site.

## Links to other services

WhatsApp, email and map links open services run by other companies, whose own terms apply.

## Content

The text and design of this website belong to {company}. Third-party photographs are used under the licences shown on the image credits page and remain the property of their authors.

## Governing law

These terms are governed by the laws of the Kingdom of Saudi Arabia.

## Contact

Questions about these terms: {email}.`,
  ar: `تنطبق هذه الشروط على استخدامك لهذا الموقع الذي تديره {company}.

## المعلومات الواردة في هذا الموقع

تُقدَّم أوصاف المعدات ومواصفاتها للاسترشاد العام. والمواصفات معتادة لكل فئة من المعدات، وقد تختلف الصناعة والطراز الفعليان للمعدة الموردة، ويتم تأكيدهما في عرض السعر. توضح الصور كل نوع من المعدات وليست بالضرورة صوراً للوحدة التي ستستلمها. ويُذكر المصورون والتراخيص في صفحة حقوق الصور.

نسعى للحفاظ على دقة هذه المعلومات وتحديثها، لكنها قد تتغير دون إشعار.

## عروض الأسعار والإيجار

لا يُبرم أي عقد إيجار من خلال هذا الموقع. يتم الاتفاق على الإيجار فقط عبر عرض سعر وعقد إيجار مكتوبين، وتحدد هذه المستندات السعر وما يشمله الإيجار والشروط المطبقة.

## السلامة والملاءمة

الأدلة ومعلومات المعدات في هذا الموقع ليست خطة رفع ولا بيان طريقة ولا استشارة هندسية. ويجب أن يؤكد أشخاص مؤهلون قاموا بتقييم الموقع ملاءمة أي معدة لمهمة معينة، وظروف الأرض، وعمليات الرفع.

## الروابط إلى خدمات أخرى

تفتح روابط واتساب والبريد الإلكتروني والخرائط خدمات تديرها شركات أخرى، وتنطبق عليها شروطها الخاصة.

## المحتوى

نصوص هذا الموقع وتصميمه مملوكة لـ {company}. وتُستخدم صور الجهات الخارجية وفق التراخيص الموضحة في صفحة حقوق الصور وتبقى ملكاً لأصحابها.

## القانون الواجب التطبيق

تخضع هذه الشروط لأنظمة المملكة العربية السعودية.

## التواصل

للاستفسار عن هذه الشروط: {email}.`,
};
