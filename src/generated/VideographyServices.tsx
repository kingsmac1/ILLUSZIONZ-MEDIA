import { A } from '../components/A'
import { BookableGrid, BookNow } from '../components/BookableGrid'
import { VIDEOGRAPHY_CARDS } from '../booking/cards'
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
          <BookableGrid id="book" columns={3} cards={VIDEOGRAPHY_CARDS}></BookableGrid>
        </div>
      </div>
    </div>
  )
}
