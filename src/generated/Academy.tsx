import { BookableGrid, BookNow } from '../components/BookableGrid'
import { ACADEMY_CARDS } from '../booking/cards'
import './academy.css'



export default function Academy() {
  return (
    <div className="aca-1">
      <div className="aca-2">
        <div className="aca-3">
          <div className="aca-4">
            <div className="aca-5">
              <h2 className="aca-6">Knowledge is Vision</h2>
            </div>
            <div className="aca-5">
              <h2 className="aca-7">
                IlluszionzMedia
                <br className="aca-8" />
                Academy
              </h2>
            </div>
            <div className="aca-9">
              <div className="aca-10">
                <span className="aca-11"></span>
              </div>
            </div>
            <div className="aca-12">
              <p className="aca-13">Beyond the lens, we provide strategic industry support to bring complex visions to life, from scouting to large-scale event consultation.</p>
            </div>
          </div>
        </div>
      </div>
      <div className="sc-section">
        <div className="sc-section-inner">
          <div className="sc-head">
            <div>
              <p className="sc-eyebrow">Curriculum</p>
              <h2>Available Courses</h2>
            </div>
            <blockquote>“Our courses are built on real-world agency experience, not just theory.”</blockquote>
          </div>
          <BookableGrid id="courses" columns={3} cards={ACADEMY_CARDS}></BookableGrid>
        </div>
      </div>
      <div className="aca-2">
        <div className="aca-38">
          <div className="aca-39">
            <div className="aca-40">
              <h2 className="aca-41">
                {"Ready to Master "}
                <br className="aca-8" />
                The Visual Arts?
              </h2>
            </div>
            <div className="aca-42">
              <h2 className="aca-43">Join our next intake and start your journey towards becoming a world-class creative professional.</h2>
            </div>
            <div className="aca-40">
              <a className="aca-44" href="#courses">
                <span className="aca-45">
                  <span className="aca-37">ENROLL NOW</span>
                </span>
              </a>
            </div>
            <div className="aca-40">
              <h2 className="aca-46">Limited spots available per intake to ensure personalized learning.</h2>
            </div>
          </div>
        </div>
      </div>
      <div className="aca-73">
        <div className="aca-74">
          <div className="aca-75">
            <p className="aca-13">we accept, visa, mastercard, american express, discover, clearpay, klarna and all major credit cards</p>
          </div>
          <div className="aca-76">
            <div className="aca-77">
              <img className="aca-78" width={1117} height={498} src="/images/visa.png" alt="" />
            </div>
            <div className="aca-79">
              <img className="aca-80" width={844} height={571} src="/images/mastercard.png" alt="" />
            </div>
            <div className="aca-79">
              <img className="aca-81" width={1020} height={454} src="/images/american-ex.png" alt="" />
            </div>
            <div className="aca-77">
              <img className="aca-82" width={900} height={322} src="/images/discover.png" alt="" />
            </div>
            <div className="aca-79">
              <img className="aca-83" width={1052} height={288} src="/images/clearpay.png" alt="" />
            </div>
            <div className="aca-79">
              <img className="aca-84" width={980} height={436} src="/images/klarna.png" alt="" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
