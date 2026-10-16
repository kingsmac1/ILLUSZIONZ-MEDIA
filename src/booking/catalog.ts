/**
 * Every bookable service: the packages, add-ons, questions and policies for its multi-step form.
 * The same file is used by the browser (to render + price the form) and by the Cloudflare Pages
 * Function (to re-price and validate the submission), so the two can never disagree.
 */

export type FieldType = 'text' | 'tel' | 'email' | 'date' | 'time' | 'textarea' | 'select' | 'chips' | 'number'

export type Field = {
  id: string
  label: string
  type: FieldType
  required?: boolean
  options?: string[]
  placeholder?: string
  /** render at half width on wide screens */
  half?: boolean
  /** chips: allow several answers */
  multi?: boolean
  autoComplete?: string
}

export type Option = {
  id: string
  label: string
  /** price in GBP, 0 = quoted later */
  price: number
  /** short line shown under the label, e.g. "4 edited pictures" */
  note?: string
  /** bullet points shown with the option */
  includes?: string[]
  /** price is multiplied by a quantity the client chooses (looks, hours …) */
  unit?: { label: string; plural: string; min: number; max: number; def: number }
}

export type Extra = {
  id: string
  label: string
  /** price in GBP (0 + priceNote = quoted) */
  price: number
  note?: string
  /** when set the client picks a quantity 1..max, otherwise it is a simple toggle */
  max?: number
  unit?: string
  priceNote?: string
  /** "from £200" style */
  from?: boolean
}

export type Step = { id: string; title: string; blurb?: string; fields: Field[] }

export type Flow = {
  id: string
  /** used in email subjects: "Portrait booking" */
  kind: string
  title: string
  intro: string
  /** heading for the package step */
  optionTitle: string
  optionBlurb?: string
  optionsMulti?: boolean
  options: Option[]
  steps: Step[]
  extrasTitle?: string
  extrasBlurb?: string
  extras: Extra[]
  terms: string[]
  /** shown on the review step and in emails when nothing is priced */
  quoteText?: string
  submitLabel?: string
  /** payment link appended to the confirmation (e.g. Selar) */
  payLink?: string
  /** headline for the customer email */
  headline: string
  nextSteps: string[]
}

export type Selection = {
  flowId: string
  optionIds: string[]
  units: Record<string, number>
  extras: Record<string, number>
  fields: Record<string, string>
  /** promo code typed by the client (validated again on the server) */
  promo?: string
}

export type Quote = {
  lines: { label: string; amount: string; value: number }[]
  total: number
  totalText: string
  quoted: boolean
}

export const formatGBP = (n: number) => `£${n.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`

/* --------------------------------- common --------------------------------- */

const who = (blurb = 'So we know who to confirm with.'): Step => ({
  id: 'you',
  title: 'About you',
  blurb,
  fields: [
    { id: 'name', label: 'Full name', type: 'text', required: true, half: true, autoComplete: 'name' },
    { id: 'phone', label: 'WhatsApp / phone', type: 'tel', required: true, half: true, placeholder: '+44 …', autoComplete: 'tel' },
    { id: 'email', label: 'Email', type: 'email', required: true, autoComplete: 'email' },
  ],
})

const shootDetails = (extra: Field[] = []): Step => ({
  id: 'shoot',
  title: 'Your session',
  blurb: 'When, where and the look you have in mind.',
  fields: [
    { id: 'date', label: 'Preferred date', type: 'date', required: true, half: true },
    { id: 'time', label: 'Preferred time', type: 'time', required: true, half: true },
    { id: 'setting', label: 'Setting', type: 'chips', required: true, options: ['Studio', 'Outdoor', 'Home / venue'] },
    { id: 'location', label: 'Location / area', type: 'text', placeholder: 'Postcode or area (for outdoor / venue shoots)' },
    ...extra,
    { id: 'inspiration', label: 'Inspiration links or ideas', type: 'textarea', placeholder: 'Pinterest, Instagram, colours, mood …' },
    { id: 'notes', label: 'Anything else we should know?', type: 'textarea' },
  ],
})

const photoExtras: Extra[] = [
  { id: 'extra-images', label: 'Extra edited pictures', price: 20, max: 40, unit: 'picture', note: 'Per additional edited image' },
  { id: 'express-24', label: '24-hour express turnaround', price: 50, note: 'Edited pictures back within 24 hours' },
  { id: 'express-48', label: '48-hour express turnaround', price: 35, note: 'Edited pictures back within 48 hours' },
  { id: 'extra-person', label: 'Additional person in frame', price: 40, max: 10, unit: 'person' },
  { id: 'outdoor-logistics', label: 'Outdoor logistics', price: 0, priceNote: 'Based on distance', note: 'Applies to off-site shoots' },
]

const photoTerms = [
  'Single outfit: full payment is required when booking.',
  'Multiple outfits: 80% deposit secures the booking; the balance is paid straight after the shoot.',
  'Appointments are strictly by time slot — lateness may attract extra charges or cancellation (delay fee £15 per 30 minutes).',
  'Pictures are delivered in soft copies via Google Drive or WhatsApp. Frames, USB and photobooks are available at additional charge.',
]

const photoNext = [
  'We confirm your date and send payment details on WhatsApp or email.',
  'Your session is secured once payment (or the 80% deposit) is received.',
  'Edited pictures are delivered 7–10 days after selection.',
]

/* ---------------------------------- flows ---------------------------------- */

export const flows: Record<string, Flow> = {
  portrait: {
    id: 'portrait',
    kind: 'Portrait booking',
    title: 'Portrait Photography',
    intro: 'Choose your package, tell us about your session and add any extras. It takes about two minutes.',
    optionTitle: 'Choose your package',
    options: [
      { id: 'portrait-1', label: '1 Look', price: 170, note: '4 edited pictures' },
      { id: 'portrait-2', label: '2 Looks', price: 300, note: '8 edited pictures' },
    ],
    steps: [who(), shootDetails([{ id: 'people', label: 'Number of people', type: 'select', options: ['1', '2', '3', '4', '5+'], half: true }])],
    extrasTitle: 'Add-ons & extras',
    extras: photoExtras,
    terms: photoTerms,
    headline: 'Booking request received',
    nextSteps: photoNext,
  },
  maternity: {
    id: 'maternity',
    kind: 'Maternity booking',
    title: 'Maternity Photography',
    intro: 'Celebrate this chapter. Choose a package, then tell us about your session.',
    optionTitle: 'Choose your package',
    options: [
      { id: 'maternity-1', label: '1 Look', price: 170, note: '4 edited pictures' },
      { id: 'maternity-couple', label: 'Couple · 1 Look', price: 200, note: '6 edited pictures' },
    ],
    steps: [
      who(),
      shootDetails([{ id: 'weeks', label: 'Weeks pregnant', type: 'number', half: true, placeholder: 'e.g. 32' }]),
    ],
    extrasTitle: 'Add-ons & extras',
    extras: photoExtras,
    terms: photoTerms,
    headline: 'Booking request received',
    nextSteps: photoNext,
  },
  baby: {
    id: 'baby',
    kind: 'Baby shoot booking',
    title: 'Baby Shoot',
    intro: 'Gentle, relaxed sessions. Choose a package and tell us about your little one.',
    optionTitle: 'Choose your package',
    options: [
      { id: 'baby-1', label: '1 Look', price: 150, note: '4 edited pictures' },
      { id: 'baby-2', label: '2 Looks', price: 250, note: '8 edited pictures' },
    ],
    steps: [
      who(),
      shootDetails([{ id: 'age', label: "Baby's age", type: 'text', half: true, placeholder: 'e.g. 8 months' }]),
    ],
    extrasTitle: 'Add-ons & extras',
    extras: photoExtras,
    terms: photoTerms,
    headline: 'Booking request received',
    nextSteps: photoNext,
  },
  prewedding: {
    id: 'prewedding',
    kind: 'Prewedding / engagement booking',
    title: 'Prewedding / Engagement Pictures',
    intro: 'Choose how many looks you would like, then tell us about your session.',
    optionTitle: 'Choose your package',
    options: [
      { id: 'prewedding-1', label: '1 Look', price: 200, note: '7 images per look' },
      { id: 'prewedding-2', label: '2 Looks', price: 400, note: '7 images per look' },
      { id: 'prewedding-3', label: '3 Looks', price: 500, note: '7 images per look' },
    ],
    steps: [
      who('Whose day is it? Put the name of one partner or both.'),
      shootDetails([{ id: 'weddingDate', label: 'Wedding date (if set)', type: 'date', half: true }]),
    ],
    extrasTitle: 'Add-ons & extras',
    extras: photoExtras,
    terms: photoTerms,
    headline: 'Booking request received',
    nextSteps: photoNext,
  },
  events: {
    id: 'events',
    kind: 'Event photography booking',
    title: 'Events Photography',
    intro: 'Naming ceremonies, birthday parties and more. Tell us the hours you need — a 3-hour minimum applies within London.',
    optionTitle: 'Choose your coverage',
    options: [
      {
        id: 'events-hourly',
        label: 'Event coverage',
        price: 150,
        note: 'Per hour · within London · discount considered on multiple hours',
        unit: { label: 'hour', plural: 'hours', min: 3, max: 12, def: 3 },
      },
    ],
    steps: [
      who(),
      {
        id: 'event',
        title: 'Your event',
        blurb: 'The day, the venue and the moments that matter.',
        fields: [
          { id: 'eventType', label: 'Type of event', type: 'chips', required: true, options: ['Naming ceremony', 'Birthday party', 'Graduation', 'Other'] },
          { id: 'date', label: 'Event date', type: 'date', required: true, half: true },
          { id: 'time', label: 'Start time', type: 'time', required: true, half: true },
          { id: 'venue', label: 'Venue / address', type: 'text', required: true },
          { id: 'guests', label: 'Estimated guests', type: 'number', half: true },
          { id: 'notes', label: 'Key moments or requests', type: 'textarea' },
        ],
      },
    ],
    extrasTitle: 'Add-ons & extras',
    extras: photoExtras.filter((e) => e.id !== 'extra-person'),
    terms: photoTerms,
    headline: 'Event booking request received',
    nextSteps: photoNext,
  },
  family: {
    id: 'family',
    kind: 'Family session booking',
    title: 'Family Photo Sessions',
    intro: 'A family of 4 per look. Add extra family members below.',
    optionTitle: 'Choose your session',
    options: [
      {
        id: 'family-look',
        label: 'Family of 4',
        price: 250,
        note: '7 pictures per look',
        unit: { label: 'look', plural: 'looks', min: 1, max: 4, def: 1 },
      },
    ],
    steps: [
      who(),
      shootDetails([{ id: 'people', label: 'Family size', type: 'select', options: ['2', '3', '4', '5', '6', '7', '8+'], half: true }]),
    ],
    extrasTitle: 'Add-ons & extras',
    extras: [
      { id: 'family-extra-person', label: 'Extra family member', price: 20, max: 10, unit: 'person', note: 'Per extra person beyond four' },
      ...photoExtras.filter((e) => e.id !== 'extra-person'),
    ],
    terms: photoTerms,
    headline: 'Booking request received',
    nextSteps: photoNext,
  },

  /* ------------------------------- weddings ------------------------------- */
  wedding: {
    id: 'wedding',
    kind: 'Wedding enquiry',
    title: 'Wedding Photography',
    intro: 'Congratulations! Pick a package, tell us about your day and add any extras.',
    optionTitle: 'Choose your package',
    options: [
      {
        id: 'wedding-silver',
        label: 'Silver Package',
        price: 1100,
        note: '8 hours',
        includes: ['All softcopies in Google Drive, downloadable', 'All soft copies also on a Flash Drive', 'A photo frame'],
      },
      {
        id: 'wedding-gold',
        label: 'Gold Package',
        price: 1300,
        note: '10 hours',
        includes: ['All softcopies in Google Drive (downloadable)', 'All softcopies in a customized webpage', 'All soft copies on a Flash Drive', '1 look complimentary prewedding', 'A mini photobook', 'A wall frame'],
      },
      {
        id: 'wedding-diamond',
        label: 'Diamond Package',
        price: 1700,
        note: '12 hours',
        includes: ['All pictures in Google Drive (downloadable)', 'All softcopies in a customized webpage', 'All soft copies on a Flash Drive', '2 hours complimentary prewedding', '2 wall frames', 'A complimentary large photobook (200 pictures)', 'Extra photographer'],
      },
      {
        id: 'wedding-traditional',
        label: 'Traditional Weddings',
        price: 900,
        note: '8 hours',
        includes: ['Softcopies in Google Drive (downloadable)', 'All soft copies on a Flash Drive', 'All softcopies in a customized webpage'],
      },
    ],
    steps: [
      who('Congratulations — who should we speak to?'),
      {
        id: 'day',
        title: 'Your day',
        blurb: 'The details we need to check availability.',
        fields: [
          { id: 'couple', label: 'Couple names', type: 'text', required: true },
          { id: 'date', label: 'Wedding date', type: 'date', required: true, half: true },
          { id: 'events', label: 'Events to cover', type: 'chips', required: true, options: ['One event', 'Two events (traditional + white)'], half: true },
          { id: 'venue', label: 'Venue / city', type: 'text', required: true },
          { id: 'guests', label: 'Estimated guests', type: 'number', half: true },
          { id: 'message', label: 'Tell us about your day', type: 'textarea', placeholder: 'Style, must-have shots, family arrangements …' },
        ],
      },
    ],
    extrasTitle: 'Extras',
    extras: [
      { id: 'w-photographer', label: 'Extra photographer', price: 350, note: 'Up to 10 hours' },
      { id: 'w-hours', label: 'Extra hours', price: 100, max: 8, unit: 'hour', note: 'Per additional hour' },
      { id: 'w-photobook', label: 'Photobook package', price: 200, from: true, note: 'Price depends on size and pages' },
      { id: 'w-usb', label: 'Extra USB', price: 50, max: 5, unit: 'USB' },
      { id: 'w-engagement', label: 'Engagement look', price: 400, note: '3 hours · 3 outfits' },
    ],
    terms: [
      'We confirm your date personally and share the booking agreement and payment details.',
      'Dates for 2026 are filling up fast — your date is secured once the deposit is paid.',
    ],
    headline: 'Wedding enquiry received',
    nextSteps: [
      'We check your date and come back to you personally.',
      'We send the booking agreement and deposit details.',
      'Your date is secured once the deposit is received.',
    ],
  },

  /* -------------------------------- academy -------------------------------- */
  academy: {
    id: 'academy',
    kind: 'Academy enrolment',
    title: 'Academy',
    intro: 'Choose your course, tell us about you and how you want to learn.',
    optionTitle: 'Choose your course',
    options: [
      { id: 'ac-zero', label: 'Zero to Pro Photography', price: 1500, note: '9 months · 2x a week · online and physical', includes: ['3-month class with 6-month mentorship', 'Camera & gear, lighting, studio setup, editing, retouching, outdoor sessions, workflow'] },
      { id: 'ac-intro-photo', label: 'Introduction to Photography', price: 499, note: '2 months · 2x a week · online and physical', includes: ['5 weeks of classes + 2 months mentorship', 'Exposure, composition, basic editing'] },
      { id: 'ac-intro-video', label: 'Introduction to Videography', price: 600, note: '2 months · 2x a week · online and physical', includes: ['6 weeks of classes + 2 months mentorship', 'Framing, sound recording, cinematic storytelling basics'] },
      { id: 'ac-upgrade', label: 'Upgrade Classes', price: 250, note: '1 week · 3hrs class over 2 days', includes: ['1 week of mentorship', 'Advanced studio lighting, complex retouching, high-end client management'] },
      { id: 'ac-ai', label: 'Creative AI Classes for Juniors', price: 400, note: '1 month · 2x a week', includes: ['Combine photography with generative AI tools safely and creatively'] },
    ],
    steps: [
      who('Who is joining the class?'),
      {
        id: 'learner',
        title: 'Learner & schedule',
        blurb: 'Helps us place you in the right class.',
        fields: [
          { id: 'age', label: 'Age', type: 'number', required: true, half: true },
          { id: 'mode', label: 'Class delivery mode', type: 'chips', required: true, options: ['Physical', 'Virtual', 'Both'], half: true },
          { id: 'address', label: 'Address', type: 'text' },
          { id: 'availability', label: 'Availability', type: 'text', placeholder: 'Days / times that work for you' },
          { id: 'goals', label: 'What do you hope to achieve at the end of this class?', type: 'textarea', required: true },
        ],
      },
    ],
    extras: [],
    terms: ['Limited spots are available per intake to ensure personalised learning.', 'Your place is confirmed once the course fee (or agreed instalment) is received.'],
    headline: 'Enrolment request received',
    nextSteps: ['We confirm the next intake dates with you.', 'We send fee and payment details.', 'Your place is confirmed on payment.'],
    submitLabel: 'Submit enrolment',
  },

  /* ------------------------------ videography ------------------------------ */
  videography: {
    id: 'videography',
    kind: 'Videography enquiry',
    title: 'Videography',
    intro: 'Tell us about your project. We review every brief and send a tailored quote.',
    optionTitle: 'What do you need?',
    optionBlurb: 'Pick one or more services.',
    optionsMulti: true,
    options: [
      { id: 'vid-wedding', label: 'Wedding Videography', price: 0 },
      { id: 'vid-drone', label: 'Drone Coverage', price: 0 },
      { id: 'vid-live', label: 'Live Streaming Production', price: 0 },
      { id: 'vid-event', label: 'Event Coverage', price: 0 },
      { id: 'vid-reels', label: 'Reels, Podcast & Interview', price: 0 },
      { id: 'vid-movie', label: 'Movie / Music Video Production', price: 0 },
      { id: 'vid-360', label: '360 Video Booth', price: 0 },
    ],
    steps: [
      who(),
      {
        id: 'project',
        title: 'Your project',
        blurb: 'The more detail, the more accurate the quote.',
        fields: [
          { id: 'date', label: 'Date / deadline', type: 'date', half: true },
          { id: 'duration', label: 'Length or duration', type: 'text', half: true, placeholder: 'e.g. 3 hours, 60-second reel' },
          { id: 'location', label: 'Location', type: 'text', required: true },
          { id: 'budget', label: 'Budget range', type: 'select', options: ['Under £500', '£500 – £1,000', '£1,000 – £2,500', '£2,500 – £5,000', '£5,000+', 'Not sure yet'] },
          { id: 'brief', label: 'Project brief', type: 'textarea', required: true, placeholder: 'What are we filming and what should it feel like?' },
          { id: 'references', label: 'Reference links', type: 'textarea', placeholder: 'YouTube, Instagram, Vimeo …' },
        ],
      },
    ],
    extrasTitle: 'Add-ons (quoted)',
    extrasBlurb: 'Tick anything you would like included in the quote.',
    extras: [
      { id: 'v-drone', label: 'Drone footage', price: 0, priceNote: 'Quoted' },
      { id: 'v-live', label: 'Live stream', price: 0, priceNote: 'Quoted' },
      { id: 'v-crew', label: 'Second camera operator', price: 0, priceNote: 'Quoted' },
      { id: 'v-sameday', label: 'Same-day highlight edit', price: 0, priceNote: 'Quoted' },
      { id: 'v-social', label: 'Social media cut-downs', price: 0, priceNote: 'Quoted' },
    ],
    terms: ['A tailored quote is sent within one working day.', 'Projects are secured once the quote is accepted and the deposit is paid.'],
    quoteText: 'Quote on request',
    headline: 'Enquiry received',
    nextSteps: ['We review your brief.', 'We send a tailored quote within one working day.', 'Your date is secured once the deposit is paid.'],
    submitLabel: 'Request my quote',
  },

  /* --------------------------------- 360 booth -------------------------------- */
  booth: {
    id: 'booth',
    kind: '360 Booth booking',
    title: '360 Video Booth',
    intro: 'Tell us about your event and we will confirm availability and send a quote.',
    optionTitle: 'Your hire',
    options: [
      {
        id: 'booth-hire',
        label: '360 Video / Photo Booth hire',
        price: 0,
        note: '3 hour hire · delivery, assembly, disassembly and removal within London',
        includes: ['Unlimited videos (your branding, message and music)', 'AirDrop and/or SMS sharing', 'Photo booth operator', 'Online gallery with all your videos'],
      },
    ],
    steps: [
      who(),
      {
        id: 'event',
        title: 'Your event',
        blurb: 'We need space, power and access.',
        fields: [
          { id: 'eventType', label: 'Event type', type: 'chips', required: true, options: ['Wedding', 'Conference', 'Church', 'Birthday', 'Corporate', 'Other'] },
          { id: 'date', label: 'Event date', type: 'date', required: true, half: true },
          { id: 'time', label: 'Start time', type: 'time', required: true, half: true },
          { id: 'address', label: 'Venue address', type: 'text', required: true },
          { id: 'city', label: 'City / postcode', type: 'text', required: true, half: true },
          { id: 'indoor', label: 'Indoor or outdoor?', type: 'chips', options: ['Indoor', 'Outdoor (covered)'], half: true },
          { id: 'notes', label: 'Anything else?', type: 'textarea' },
        ],
      },
    ],
    extrasTitle: 'Add-ons (quoted)',
    extras: [
      { id: 'b-hours', label: 'Extra hours', price: 0, max: 6, unit: 'hour', priceNote: 'Quoted' },
      { id: 'b-brand', label: 'Custom overlay & branding', price: 0, priceNote: 'Quoted' },
      { id: 'b-music', label: 'Custom music', price: 0, priceNote: 'Quoted' },
    ],
    terms: [
      'We need cubic space of 2.5m (L) × 2.5m (W) × 2.1m (H), one standard plug socket (13amp 240v), access one hour before the hire to assemble, cover from rain if outdoors and Wi-Fi.',
    ],
    quoteText: 'Quote on request',
    headline: 'Booking request received',
    nextSteps: ['We check availability for your date.', 'We send your quote and deposit details.', 'Your date is secured once the deposit is paid.'],
    submitLabel: 'Request availability',
  },

  /* ---------------------------------- agency ---------------------------------- */
  agency: {
    id: 'agency',
    kind: 'Agency consultation',
    title: 'Creative & Media Agency',
    intro: 'Tell us what you need and we will set up a consultation.',
    optionTitle: 'What do you need help with?',
    optionBlurb: 'Pick one or more.',
    optionsMulti: true,
    options: [
      { id: 'ag-location', label: 'Location Scouting', price: 0 },
      { id: 'ag-influencer', label: 'Influencer Scouting & Liaison', price: 0 },
      { id: 'ag-artists', label: 'Artists & Crew Scouting', price: 0 },
      { id: 'ag-creative-crew', label: 'Creative Crew Scouting', price: 0 },
      { id: 'ag-premiere', label: 'Movie Premiere Consulting', price: 0 },
      { id: 'ag-creative-use', label: 'Creative Use Consultation', price: 0 },
      { id: 'ag-sponsor', label: 'Sponsorship Consultation', price: 0 },
      { id: 'ag-airport', label: 'Airport Welcome Paparazzi Crew', price: 0 },
      { id: 'ag-marketing', label: 'Marketing & Branding', price: 0 },
    ],
    steps: [
      who(),
      {
        id: 'brief',
        title: 'Your brief',
        blurb: 'A few lines is enough — we will ask the rest on the call.',
        fields: [
          { id: 'brand', label: 'Brand / company', type: 'text', half: true },
          { id: 'website', label: 'Website or social link', type: 'text', half: true },
          { id: 'date', label: 'Target date', type: 'date', half: true },
          { id: 'budget', label: 'Budget range', type: 'select', half: true, options: ['Under £500', '£500 – £1,000', '£1,000 – £2,500', '£2,500 – £5,000', '£5,000+', 'Not sure yet'] },
          { id: 'brief', label: 'What do you want to achieve?', type: 'textarea', required: true },
        ],
      },
    ],
    extras: [],
    terms: ['We reply within one working day to arrange your consultation.'],
    quoteText: 'Consultation first',
    headline: 'Consultation request received',
    nextSteps: ['We review your brief.', 'We contact you to arrange a consultation.'],
    submitLabel: 'Request consultation',
  },

  /* ---------------------------------- store ---------------------------------- */
  store: {
    id: 'store',
    kind: 'Store purchase',
    title: 'Clarity & Scaling Session',
    intro: 'Book your 45-minute session. Pay securely on Selar once you have chosen a time.',
    optionTitle: 'Your session',
    options: [
      {
        id: 'store-session',
        label: 'Clarity & scaling in Photography Business',
        price: 25,
        note: '45 minute session',
        includes: ['Honest analysis of your content and mistakes you’re making', 'Scripts and hooks that make people stop scrolling', 'Monetisation strategies that actually work', 'A personalised action plan'],
      },
    ],
    steps: [
      who(),
      {
        id: 'about',
        title: 'Your business',
        blurb: 'So we can tailor the session.',
        fields: [
          { id: 'handle', label: 'Instagram / website', type: 'text', half: true },
          { id: 'niche', label: 'Your niche', type: 'text', half: true, placeholder: 'e.g. weddings, portraits, fashion' },
          { id: 'date', label: 'Preferred date', type: 'date', required: true, half: true },
          { id: 'time', label: 'Preferred time', type: 'time', required: true, half: true },
          { id: 'questions', label: 'What do you most want help with?', type: 'textarea' },
        ],
      },
    ],
    extras: [],
    terms: ['Payment is completed on Selar — your session time is confirmed once payment is received.'],
    payLink:
      'https://selar.com/braham?utm_source=ig&utm_medium=social&utm_content=link_in_bio',
    headline: 'Session request received',
    nextSteps: ['Pay securely on Selar using the button below.', 'We confirm your session time by email or WhatsApp.'],
    submitLabel: 'Submit & continue to payment',
  },
}

/* ----------------------------- pricing + helpers ----------------------------- */

export function computeQuote(flow: Flow, sel: Pick<Selection, 'optionIds' | 'units' | 'extras'>): Quote {
  const lines: Quote['lines'] = []
  let total = 0
  let quoted = false
  for (const id of sel.optionIds) {
    const o = flow.options.find((x) => x.id === id)
    if (!o) continue
    const qty = o.unit ? clamp(sel.units[id] ?? o.unit.def, o.unit.min, o.unit.max) : 1
    const value = o.price * qty
    if (o.price === 0) quoted = true
    total += value
    const label = o.unit ? `${o.label} × ${qty} ${qty === 1 ? o.unit.label : o.unit.plural}` : o.label
    lines.push({ label, amount: o.price === 0 ? 'Quoted' : formatGBP(value), value })
  }
  for (const e of flow.extras) {
    const raw = sel.extras[e.id] ?? 0
    if (raw <= 0) continue
    const qty = e.max ? clamp(raw, 1, e.max) : 1
    const value = e.price * qty
    total += value
    const base = e.max && e.max > 1 && qty > 1 ? `${e.label} × ${qty}` : e.label
    if (e.price === 0) {
      if (e.priceNote && e.priceNote !== 'Quoted') quoted = true
      lines.push({ label: base, amount: e.priceNote ?? 'Included', value: 0 })
    } else {
      lines.push({ label: e.from ? `${base} (from)` : base, amount: formatGBP(value), value })
    }
  }
  const anyPriced = flow.options.some((o) => o.price > 0)
  return {
    lines,
    total,
    quoted,
    totalText: anyPriced ? formatGBP(total) + (quoted || flow.extras.some((e) => e.from && (sel.extras[e.id] ?? 0) > 0) ? '+' : '') : flow.quoteText ?? 'To be quoted',
  }
}

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, Math.round(n)))

/** Validates one answer against its field definition. Returns an error message or ''. */
export function validateField(f: Field, value: string): string {
  const v = value.trim()
  if (!v) return f.required ? 'Required' : ''
  if (f.type === 'email' && !/^\S+@\S+\.\S+$/.test(v)) return 'Enter a valid email'
  if (f.type === 'tel' && v.replace(/[^\d]/g, '').length < 7) return 'Enter a valid phone number'
  if (f.type === 'number' && Number.isNaN(Number(v))) return 'Enter a number'
  if (f.type === 'select' || f.type === 'chips') {
    const parts = f.multi ? v.split(', ') : [v]
    if (f.options && parts.some((p) => !f.options!.includes(p))) return 'Choose one of the options'
  }
  return ''
}

/** Full server-side check of a selection: returns a list of problems (empty = ok). */
export function validateSelection(flow: Flow, sel: Selection): string[] {
  const errors: string[] = []
  if (!sel.optionIds.length) errors.push('Choose an option')
  if (!flow.optionsMulti && sel.optionIds.length > 1) errors.push('Choose only one option')
  for (const id of sel.optionIds) if (!flow.options.some((o) => o.id === id)) errors.push(`Unknown option ${id}`)
  for (const step of flow.steps)
    for (const f of step.fields) {
      const err = validateField(f, sel.fields[f.id] ?? '')
      if (err) errors.push(`${f.label}: ${err}`)
    }
  return errors
}

export const flowOrder = Object.keys(flows)
