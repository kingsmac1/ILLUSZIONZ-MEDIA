
import { BookableGrid, BookNow } from '../components/BookableGrid'
import './store.css'



export default function Store() {
  return (
    <div className="sto-1">
      <div className="sto-2">
        <div className="sto-3">
          <div className="sto-4">
            <div className="sto-5">
              <h2 className="sto-6">Curated Resources</h2>
            </div>
            <div className="sto-7">
              <h2 className="sto-8">IlluszionzMedia Store</h2>
            </div>
            <div className="sto-9">
              <div className="sto-10">
                <span className="sto-11"></span>
              </div>
            </div>
            <div className="sto-12">
              <p className="sto-13">Creative resources, digital tools, and media essentials curated for creators. Elevate your craft with our professional-grade assets.</p>
            </div>
          </div>
        </div>
      </div>
      <div className="sc-section">
        <div className="sc-section-inner">
          <BookableGrid id="store" columns={2} cards={[
  {
    "flowId": "store",
    "optionId": "store-session",
    "title": "To talk about clarity and scaling in Photography Business",
    "image": "/images/b_basic-79.webp",
    "price": "£25",
    "priceNote": "45 minute session",
    "description": "Here’s what you’ll get in our session:",
    "bullets": [
      "Honest analysis of your content and mistakes you’re making",
      "The new world era of video content and how to ride it",
      "Crafting scripts and hooks that make people stop scrolling",
      "Using AI as your creative partner, not your enemy",
      "Building real camera confidence (say goodbye to stage fright)",
      "Growing a loyal community that engages",
      "The best times to post for maximum reach",
      "Identifying and connecting with your true target audience",
      "Monetisation strategies that actually work"
    ],
    "cta": "Book this session"
  }
]}></BookableGrid>
        </div>
      </div>
    </div>
  )
}
