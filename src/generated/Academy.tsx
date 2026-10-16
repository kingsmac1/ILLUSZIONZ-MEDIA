import { BookableGrid, BookNow } from '../components/BookableGrid'
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
          <BookableGrid id="courses" columns={3} cards={[
  {
    "flowId": "academy",
    "optionId": "ac-zero",
    "title": "Zero to Pro Photography",
    "image": "/images/ILZ_8962.jpg",
    "price": "£1,500",
    "priceNote": "9 months",
    "description": "A comprehensive masterclass designed for absolute beginners aiming for professional mastery.",
    "bullets": [
      "Mastering your camera and gear",
      "Lighting & studio setup",
      "Editing & retouching",
      "Outdoor sessions & workflow",
      "3-month class with 6-month mentorship"
    ],
    "rows": [
      {
        "label": "Format",
        "note": "2x a week · online and physical"
      }
    ],
    "cta": "Enrol now"
  },
  {
    "flowId": "academy",
    "optionId": "ac-intro-photo",
    "title": "Introduction to Photography",
    "image": "/images/ILZ_8904.jpg",
    "price": "£499",
    "priceNote": "2 months",
    "description": "Master the fundamentals of your camera.",
    "bullets": [
      "Exposure",
      "Composition",
      "Basic editing to start your journey",
      "5 weeks class + 2 months mentorship"
    ],
    "rows": [
      {
        "label": "Format",
        "note": "2x a week · online and physical"
      }
    ],
    "cta": "Enrol now"
  },
  {
    "flowId": "academy",
    "optionId": "ac-intro-video",
    "title": "Introduction to Videography",
    "image": "/images/ILZ_8923.jpg",
    "price": "£600",
    "priceNote": "2 months",
    "description": "Capture life in motion.",
    "bullets": [
      "Framing",
      "Sound recording",
      "The basics of cinematic storytelling",
      "6 weeks class + 2 months mentorship"
    ],
    "rows": [
      {
        "label": "Format",
        "note": "2x a week · online and physical"
      }
    ],
    "cta": "Enrol now"
  },
  {
    "flowId": "academy",
    "optionId": "ac-upgrade",
    "title": "Upgrade Classes",
    "image": "/images/ILZ_8996.jpg",
    "price": "£250",
    "priceNote": "1 week",
    "description": "For active professionals. Deep dive into:",
    "bullets": [
      "Advanced studio lighting",
      "Complex retouching",
      "High-end client management",
      "3hrs class over 2 days + 1 week mentorship"
    ],
    "cta": "Enrol now"
  },
  {
    "flowId": "academy",
    "optionId": "ac-ai",
    "title": "Creative AI Classes for Juniors",
    "image": "/images/ILZ_8966.jpg",
    "price": "£400",
    "priceNote": "1 month",
    "description": "Empowering the next generation with future-ready skills.",
    "bullets": [
      "Combine photography with generative AI tools safely and creatively",
      "2x a week class"
    ],
    "cta": "Enrol now"
  }
]}></BookableGrid>
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
