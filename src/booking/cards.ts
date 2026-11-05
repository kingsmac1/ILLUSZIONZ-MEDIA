/**
 * The price cards on the service pages (moved here from the pages so the dashboard can list them).
 * Each card's photo can be changed in Dashboard → Prices → Card photos; this file keeps the built-in photo.
 */
import type { CardDef } from '../components/BookableGrid'

export const PHOTOGRAPHY_CARDS: CardDef[] = [
  {
    flowId: "portrait",
    optionId: "portrait-1",
    title: "Portrait Photography",
    image: "/images/imgi_18_591140939_18544250149022665_4243811256061463776_n.jpg",
    fromLabel: "From",
    price: "£170",
    rows: [
      {
        label: "1 Look",
        note: "4 edited pictures",
        price: "£170",
        optionId: "portrait-1"
      },
      {
        label: "More looks?",
        note: "Choose how many when you book. We agree the price for extra looks with you on WhatsApp."
      }
    ],
    cta: "Book this shoot"
  },
  {
    flowId: "maternity",
    optionId: "maternity-1",
    title: "Maternity Photography",
    image: "/images/imgi_19_419535905_1050178712906946_6381751784486071102_n.jpg",
    fromLabel: "From",
    price: "£170",
    rows: [
      {
        label: "1 Look",
        note: "4 edited pictures",
        price: "£170",
        optionId: "maternity-1"
      },
      {
        label: "Couple · 1 Look",
        note: "6 edited pictures",
        price: "£200",
        optionId: "maternity-couple"
      },
      {
        label: "More looks?",
        note: "Choose how many when you book. We agree the price for extra looks with you on WhatsApp."
      }
    ],
    cta: "Book this shoot"
  },
  {
    flowId: "baby",
    optionId: "baby-1",
    title: "Baby Shoot",
    image: "/images/imgi_21_446468227_1194906268165586_3622239586575587069_n.jpg",
    fromLabel: "From",
    price: "£150",
    rows: [
      {
        label: "1 Look",
        note: "4 edited pictures",
        price: "£150",
        optionId: "baby-1"
      },
      {
        label: "More looks?",
        note: "Choose how many when you book. We agree the price for extra looks with you on WhatsApp."
      }
    ],
    cta: "Book this shoot"
  },
  {
    flowId: "prewedding",
    optionId: "prewedding-1",
    title: "Prewedding / Engagement Pictures",
    image: "/images/ILU6448-1.webp",
    fromLabel: "From",
    price: "£200",
    rows: [
      {
        label: "1 Look",
        note: "7 images per look",
        price: "£200",
        optionId: "prewedding-1"
      },
      {
        label: "More looks?",
        note: "Choose how many when you book. We agree the price for extra looks with you on WhatsApp."
      }
    ],
    cta: "Book this shoot"
  },
  {
    flowId: "events",
    optionId: "events-hourly",
    title: "Events Photography",
    image: "/images/imgi_15_447522866_977681870302310_4655339828997709344_n.jpg",
    fromLabel: "From",
    price: "£150",
    priceNote: "per hour",
    description: "Naming ceremonies, birthday parties and more. Discount considered on multiple hours.",
    rows: [
      {
        label: "Event coverage",
        note: "3 hours minimum · within London",
        price: "£150/hr",
        optionId: "events-hourly"
      }
    ],
    cta: "Book this event"
  },
  {
    flowId: "family",
    optionId: "family-look",
    title: "Family Photo Sessions",
    image: "/images/ILU6185.webp",
    fromLabel: "From",
    price: "£250",
    rows: [
      {
        label: "Family of 4",
        note: "7 pictures per look",
        price: "£250",
        optionId: "family-look"
      },
      {
        label: "Extra person",
        price: "£20 each"
      },
      {
        label: "More looks?",
        note: "Choose how many when you book. We agree the price for extra looks with you on WhatsApp."
      }
    ],
    cta: "Book this shoot"
  }
]

export const VIDEOGRAPHY_CARDS: CardDef[] = [
  {
    flowId: "videography",
    optionId: "vid-wedding",
    title: "Wedding Videography",
    image: "/images/imgi_13_325350223_167249076020601_2069285591843222161_n.jpg",
    description: "Relive your wedding day through cinematic films that capture every emotion and unforgettable moment. We craft timeless videos that tell your love story with style, authenticity and heart.",
    quoteLabel: "Open for consultation",
    cta: "Get a quote"
  },
  {
    flowId: "videography",
    optionId: "vid-drone",
    title: "Drone Coverage",
    image: "/images/drone-600700.jpg.webp",
    description: "Elevate your story with breathtaking aerial footage. Licensed drone pilots capture sweeping venue reveals, landscapes and event overviews in crisp 4K.",
    quoteLabel: "Open for consultation",
    cta: "Get a quote"
  },
  {
    flowId: "videography",
    optionId: "vid-live",
    title: "Live Streaming Production",
    image: "/images/7-1-1024x576-1.jpg",
    description: "Take your event to a global audience. Multi-camera live streaming with professional switching, clean audio and graphics for weddings, conferences, concerts and church services.",
    quoteLabel: "Open for consultation",
    cta: "Get a quote"
  },
  {
    flowId: "videography",
    optionId: "vid-event",
    title: "Event Coverage",
    image: "/images/imgi_15_447522866_977681870302310_4655339828997709344_n.jpg",
    description: "Capture the energy and atmosphere of your event with cinematic highlights and full-length coverage. From candid moments to key speeches, we preserve every detail with professional precision.",
    quoteLabel: "Open for consultation",
    cta: "Get a quote"
  },
  {
    flowId: "videography",
    optionId: "vid-reels",
    title: "Reels, Podcast & Interview",
    image: "/images/Photography-Videography-service-Ramal.webp",
    description: "Scroll-stopping reels, studio-quality podcasts and polished interviews. We handle filming, sound, editing and captions so your content looks and sounds premium.",
    quoteLabel: "Open for consultation",
    cta: "Get a quote"
  },
  {
    flowId: "videography",
    optionId: "vid-movie",
    title: "Movie / Music Video Production",
    image: "/images/Photography-and-Videography-Services-in-Prescott-Arizona.webp",
    description: "From concept to final cut: treatment, directing, cinematography and colour grading for music videos, short films and brand films that command attention.",
    quoteLabel: "Open for consultation",
    cta: "Get a quote"
  },
  {
    flowId: "booth",
    optionId: "booth-hire",
    title: "360 Video Booth",
    image: "/images/s-l1200-1.jpg",
    description: "Step into the spotlight with our 360 Video Booth, where every spin turns your moment into a cinematic experience. Bold, share-worthy content that keeps your event unforgettable.",
    quoteLabel: "Open for consultation",
    cta: "Check availability"
  }
]

export const WEDDING_CARDS: CardDef[] = [
  {
    flowId: "wedding",
    optionId: "wedding-silver",
    title: "Silver Package",
    image: "/images/imgi_13_325350223_167249076020601_2069285591843222161_n.jpg",
    price: "£1,100",
    priceNote: "8 hours",
    bullets: [
      "All softcopies in Google Drive, downloadable",
      "All soft copies also on a Flash Drive",
      "A photo frame"
    ],
    cta: "Book Silver"
  },
  {
    flowId: "wedding",
    optionId: "wedding-gold",
    title: "Gold Package",
    image: "/images/ILU6448.webp",
    price: "£1,300",
    priceNote: "10 hours",
    bullets: [
      "All softcopies in Google Drive (downloadable)",
      "All softcopies in a customized webpage",
      "All soft copies on a Flash Drive",
      "1 look complimentary prewedding",
      "A mini photobook",
      "A wall frame"
    ],
    cta: "Book Gold"
  },
  {
    flowId: "wedding",
    optionId: "wedding-diamond",
    title: "Diamond Package",
    image: "/images/ILU3195.webp",
    price: "£1,700",
    priceNote: "12 hours",
    bullets: [
      "All pictures in Google Drive (downloadable)",
      "All softcopies in a customized webpage",
      "All soft copies on a Flash Drive",
      "2 hours complimentary prewedding",
      "2 wall frames",
      "A complimentary large photobook (200 pictures)",
      "Extra photographer"
    ],
    cta: "Book Diamond"
  },
  {
    flowId: "wedding",
    optionId: "wedding-traditional",
    title: "Traditional Weddings",
    image: "/images/ILU6151.webp",
    price: "£900",
    priceNote: "8 hours",
    bullets: [
      "Softcopies in Google Drive (downloadable)",
      "All soft copies on a Flash Drive",
      "All softcopies in a customized webpage"
    ],
    cta: "Book Traditional"
  }
]

export const ACADEMY_CARDS: CardDef[] = [
  {
    flowId: "academy",
    optionId: "ac-zero",
    title: "Zero to Pro Photography",
    image: "/images/ILZ_8962.jpg",
    price: "£1,500",
    priceNote: "9 months",
    description: "A comprehensive masterclass designed for absolute beginners aiming for professional mastery.",
    bullets: [
      "Mastering your camera and gear",
      "Lighting & studio setup",
      "Editing & retouching",
      "Outdoor sessions & workflow",
      "3-month class with 6-month mentorship"
    ],
    rows: [
      {
        label: "Format",
        note: "2x a week · online and physical"
      }
    ],
    cta: "Enrol now"
  },
  {
    flowId: "academy",
    optionId: "ac-intro-photo",
    title: "Introduction to Photography",
    image: "/images/ILZ_8904.jpg",
    price: "£499",
    priceNote: "2 months",
    description: "Master the fundamentals of your camera.",
    bullets: [
      "Exposure",
      "Composition",
      "Basic editing to start your journey",
      "5 weeks class + 2 months mentorship"
    ],
    rows: [
      {
        label: "Format",
        note: "2x a week · online and physical"
      }
    ],
    cta: "Enrol now"
  },
  {
    flowId: "academy",
    optionId: "ac-intro-video",
    title: "Introduction to Videography",
    image: "/images/ILZ_8923.jpg",
    price: "£600",
    priceNote: "2 months",
    description: "Capture life in motion.",
    bullets: [
      "Framing",
      "Sound recording",
      "The basics of cinematic storytelling",
      "6 weeks class + 2 months mentorship"
    ],
    rows: [
      {
        label: "Format",
        note: "2x a week · online and physical"
      }
    ],
    cta: "Enrol now"
  },
  {
    flowId: "academy",
    optionId: "ac-upgrade",
    title: "Upgrade Classes",
    image: "/images/ILZ_8996.jpg",
    price: "£250",
    priceNote: "1 week",
    description: "For active professionals. Deep dive into:",
    bullets: [
      "Advanced studio lighting",
      "Complex retouching",
      "High-end client management",
      "3hrs class over 2 days + 1 week mentorship"
    ],
    cta: "Enrol now"
  },
  {
    flowId: "academy",
    optionId: "ac-ai",
    title: "Creative AI Classes for Juniors",
    image: "/images/ILZ_8966.jpg",
    price: "£400",
    priceNote: "1 month",
    description: "Empowering the next generation with future-ready skills.",
    bullets: [
      "Combine photography with generative AI tools safely and creatively",
      "2x a week class"
    ],
    cta: "Enrol now"
  }
]

export const AGENCY_CARDS: CardDef[] = [
  {
    flowId: "agency",
    optionId: "ag-location",
    title: "Location Scouting",
    description: "Find the perfect backdrop for your shoot, film or campaign.",
    cta: "Enquire"
  },
  {
    flowId: "agency",
    optionId: "ag-influencer",
    title: "Influencer Scouting & Liaison",
    description: "Match your brand with the right creators and manage the relationship.",
    cta: "Enquire"
  },
  {
    flowId: "agency",
    optionId: "ag-artists",
    title: "Artists & Crew Scouting",
    description: "Casting and crew sourcing for productions of every size.",
    cta: "Enquire"
  },
  {
    flowId: "agency",
    optionId: "ag-creative-crew",
    title: "Creative Crew Scouting",
    description: "Stylists, make-up artists, set designers and more.",
    cta: "Enquire"
  },
  {
    flowId: "agency",
    optionId: "ag-premiere",
    title: "Movie Premiere Consulting",
    description: "Planning and delivery support for premieres and screenings.",
    cta: "Enquire"
  },
  {
    flowId: "agency",
    optionId: "ag-creative-use",
    title: "Creative Use Consultation",
    description: "Make the most of your content, locations and assets.",
    cta: "Enquire"
  },
  {
    flowId: "agency",
    optionId: "ag-sponsor",
    title: "Sponsorship Consultation",
    description: "Structure and pitch sponsorship deals that work.",
    cta: "Enquire"
  },
  {
    flowId: "agency",
    optionId: "ag-airport",
    title: "Airport Welcome Paparazzi Crew",
    description: "A red-carpet welcome with a photo and video crew.",
    cta: "Enquire"
  }
]

/** every built-in card, by page */
export const PAGE_CARDS: { page: string; path: string; cards: CardDef[] }[] = [
  { page: 'Photography services', path: '/photography-services', cards: PHOTOGRAPHY_CARDS },
  { page: 'Wedding', path: '/wedding', cards: WEDDING_CARDS },
  { page: 'Videography services', path: '/videography-services', cards: VIDEOGRAPHY_CARDS },
  { page: 'Academy', path: '/academy', cards: ACADEMY_CARDS },
  { page: 'Agency', path: '/agency', cards: AGENCY_CARDS },
]
