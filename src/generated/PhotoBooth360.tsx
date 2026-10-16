import { BookableGrid, BookNow } from '../components/BookableGrid'
import './360-photo-booth.css'



export default function PhotoBooth360() {
  return (
    <div className="bth-1">
      <div className="bth-2">
        <div className="bth-3">
          <div className="bth-4">
            <h2 className="bth-5">Defining Visual Excellence</h2>
          </div>
          <div className="bth-4">
            <h2 className="bth-6">360 Video Booth</h2>
          </div>
          <div className="bth-7">
            <div className="bth-8">
              <span className="bth-9"></span>
            </div>
          </div>
          <div className="bth-10">
            <p className="bth-11">Step into the spotlight with our 360 Video/Photo Booth, where every spin turns your moment into a cinematic experience. Create bold, share-worthy content that captures attention and keeps your event unforgettable.</p>
          </div>
        </div>
      </div>
      <div className="bth-12">
        <div className="bth-13">
          <div className="bth-14">
            <div className="bth-15">
              <h2 className="bth-5">WHAT'S INCLUDED</h2>
            </div>
            <div className="bth-16">
              <ul className="bth-17">
                <li className="bth-18">‘360’ photo booth</li>
                <li className="bth-18">Unlimited videos (includes your branding, message and music)</li>
                <li className="bth-18">AirDrop and/or SMS sharing with options for branding</li>
                <li className="bth-18">
                  Photo booth operator
                  <br className="bth-18" />
                  3 hour hire
                </li>
                <li className="bth-18">Online gallery with all your videos</li>
                <li className="bth-18">Delivery, assembly, disassembly and removal within London</li>
              </ul>
            </div>
            <div className="bth-15">
              <div className="bth-19"></div>
            </div>
          </div>
          <div className="bth-20">
            <div className="bth-15">
              <h2 className="bth-5">WHAT WE NEED</h2>
            </div>
            <div className="bth-16">
              <ul className="bth-17">
                <li className="bth-18">Cubic space of 2.5m (L) x 2.5m (W) x 2.1m (H)</li>
                <li className="bth-18">Access to 1 standard plug socket (13amp 240v)</li>
                <li className="bth-18">Access 1 hour before the hire start time for assembly</li>
                <li className="bth-18">Cover from rain (if positioned outdoors)</li>
                <li className="bth-18">Wi-Fi</li>
              </ul>
              <p className="bth-17">{" "}</p>
              <p className="bth-17">{" "}</p>
              <p className="bth-17">{" "}</p>
            </div>
            <div className="bth-15">
              <div className="bth-19"></div>
            </div>
          </div>
        </div>
      </div>
      <div className="bk-dark">
        <div className="bk-dark-inner">
          <p className="sc-eyebrow is-light">Reserve your date</p>
          <h2>Book for your 360 Booth</h2>
          <p>Tell us about your event and we will confirm availability and send your quote.</p>
          <BookNow flowId="booth" optionId="booth-hire" label="Book the 360 Booth" className="bk-dark-btn" />
        </div>
      </div>
    </div>
  )
}
