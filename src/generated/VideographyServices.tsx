import { A } from '../components/A'
import { BookableGrid, BookNow } from '../components/BookableGrid'
import './videography-services.css'



export default function VideographyServices() {
  return (
    <div className="vid-1">
      <div className="vid-2">
        <div className="vid-3">
          <div className="vid-4">
            <div className="vid-5">
              <h2 className="vid-6">Motion Picture Experts</h2>
            </div>
            <div className="vid-5">
              <h2 className="vid-7">Videography Services</h2>
            </div>
            <div className="vid-8">
              <div className="vid-9">
                <span className="vid-10"></span>
              </div>
            </div>
            <div className="vid-11">
              <p className="vid-12">Bringing stories to life through cinematic movement, expert sound design, and visual mastery. From corporate narratives to high-energy music videos, we produce motion content that commands attention.</p>
            </div>
          </div>
        </div>
      </div>
      <div className="sc-section">
        <div className="sc-section-inner">
          <BookableGrid id="book" columns={3} cards={[
  {
    "flowId": "videography",
    "optionId": "vid-wedding",
    "title": "Wedding Videography",
    "image": "/images/imgi_13_325350223_167249076020601_2069285591843222161_n.jpg",
    "description": "Relive your wedding day through cinematic films that capture every emotion and unforgettable moment. We craft timeless videos that tell your love story with style, authenticity and heart.",
    "quoteLabel": "Open for consultation",
    "cta": "Get a quote"
  },
  {
    "flowId": "videography",
    "optionId": "vid-drone",
    "title": "Drone Coverage",
    "image": "/images/drone-600700.jpg.webp",
    "description": "Elevate your story with breathtaking aerial footage. Licensed drone pilots capture sweeping venue reveals, landscapes and event overviews in crisp 4K.",
    "quoteLabel": "Open for consultation",
    "cta": "Get a quote"
  },
  {
    "flowId": "videography",
    "optionId": "vid-live",
    "title": "Live Streaming Production",
    "image": "/images/7-1-1024x576-1.jpg",
    "description": "Take your event to a global audience. Multi-camera live streaming with professional switching, clean audio and graphics for weddings, conferences, concerts and church services.",
    "quoteLabel": "Open for consultation",
    "cta": "Get a quote"
  },
  {
    "flowId": "videography",
    "optionId": "vid-event",
    "title": "Event Coverage",
    "image": "/images/imgi_15_447522866_977681870302310_4655339828997709344_n.jpg",
    "description": "Capture the energy and atmosphere of your event with cinematic highlights and full-length coverage. From candid moments to key speeches, we preserve every detail with professional precision.",
    "quoteLabel": "Open for consultation",
    "cta": "Get a quote"
  },
  {
    "flowId": "videography",
    "optionId": "vid-reels",
    "title": "Reels, Podcast & Interview",
    "image": "/images/Photography-Videography-service-Ramal.webp",
    "description": "Scroll-stopping reels, studio-quality podcasts and polished interviews. We handle filming, sound, editing and captions so your content looks and sounds premium.",
    "quoteLabel": "Open for consultation",
    "cta": "Get a quote"
  },
  {
    "flowId": "videography",
    "optionId": "vid-movie",
    "title": "Movie / Music Video Production",
    "image": "/images/Photography-and-Videography-Services-in-Prescott-Arizona.webp",
    "description": "From concept to final cut: treatment, directing, cinematography and colour grading for music videos, short films and brand films that command attention.",
    "quoteLabel": "Open for consultation",
    "cta": "Get a quote"
  },
  {
    "flowId": "booth",
    "optionId": "booth-hire",
    "title": "360 Video Booth",
    "image": "/images/s-l1200-1.jpg",
    "description": "Step into the spotlight with our 360 Video Booth, where every spin turns your moment into a cinematic experience. Bold, share-worthy content that keeps your event unforgettable.",
    "quoteLabel": "Open for consultation",
    "cta": "Check availability"
  }
]}></BookableGrid>
        </div>
      </div>
    </div>
  )
}
