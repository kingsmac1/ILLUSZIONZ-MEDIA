import { A } from '../components/A'
import { BookableGrid, BookNow } from '../components/BookableGrid'
import './agency.css'



export default function Agency() {
  return (
    <div className="age-1">
      <div className="age-2">
        <div className="age-3">
          <div className="age-4">
            <div className="age-5">
              <h2 className="age-6">Comprehensive Solution</h2>
            </div>
            <div className="age-5">
              <h2 className="age-7">
                {"Creative & Media "}
                <br className="age-8" />
                Agency Services
              </h2>
            </div>
            <div className="age-9">
              <div className="age-10">
                <span className="age-11"></span>
              </div>
            </div>
            <div className="age-12">
              <p className="age-13">Beyond the lens, we provide strategic industry support to bring complex visions to life, from scouting to large-scale event consultation.</p>
            </div>
          </div>
        </div>
      </div>
      <div className="sc-section">
        <div className="sc-section-inner">
          <BookableGrid id="consult" columns={4} cards={[
  {
    "flowId": "agency",
    "optionId": "ag-location",
    "title": "Location Scouting",
    "description": "Find the perfect backdrop for your shoot, film or campaign.",
    "cta": "Enquire"
  },
  {
    "flowId": "agency",
    "optionId": "ag-influencer",
    "title": "Influencer Scouting & Liaison",
    "description": "Match your brand with the right creators and manage the relationship.",
    "cta": "Enquire"
  },
  {
    "flowId": "agency",
    "optionId": "ag-artists",
    "title": "Artists & Crew Scouting",
    "description": "Casting and crew sourcing for productions of every size.",
    "cta": "Enquire"
  },
  {
    "flowId": "agency",
    "optionId": "ag-creative-crew",
    "title": "Creative Crew Scouting",
    "description": "Stylists, make-up artists, set designers and more.",
    "cta": "Enquire"
  },
  {
    "flowId": "agency",
    "optionId": "ag-premiere",
    "title": "Movie Premiere Consulting",
    "description": "Planning and delivery support for premieres and screenings.",
    "cta": "Enquire"
  },
  {
    "flowId": "agency",
    "optionId": "ag-creative-use",
    "title": "Creative Use Consultation",
    "description": "Make the most of your content, locations and assets.",
    "cta": "Enquire"
  },
  {
    "flowId": "agency",
    "optionId": "ag-sponsor",
    "title": "Sponsorship Consultation",
    "description": "Structure and pitch sponsorship deals that work.",
    "cta": "Enquire"
  },
  {
    "flowId": "agency",
    "optionId": "ag-airport",
    "title": "Airport Welcome Paparazzi Crew",
    "description": "A red-carpet welcome with a photo and video crew.",
    "cta": "Enquire"
  }
]}></BookableGrid>
        </div>
      </div>
      <div className="age-25">
        <div className="age-26">
          <div className="age-27">
            <div className="age-28"></div>
            <div className="age-29">
              <div className="age-30">
                <div className="age-31">
                  <div className="age-32">
                    <span className="age-33">
                      <svg className="age-34" aria-hidden="true" viewBox="0 0 256 512">
                        <path d="M88 166.059V468c0 6.627 5.373 12 12 12h56c6.627 0 12-5.373 12-12V166.059h46.059c21.382 0 32.09-25.851 16.971-40.971l-86.059-86.059c-9.373-9.373-24.569-9.373-33.941 0l-86.059 86.059c-15.119 15.119-4.411 40.971 16.971 40.971H88z" />
                      </svg>
                    </span>
                  </div>
                  <div className="age-35">
                    <p className="age-36">Growth Driven</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="age-37">
            <div className="age-16">
              <h2 className="age-38">{"Strategy & Engagement"}</h2>
            </div>
            <div className="age-16">
              <h2 className="age-39">
                {"Marketing "}
                <br className="age-8" />
                {"& Branding"}
              </h2>
            </div>
            <div className="age-40">
              <p className="age-13">We help brands grow visibility, credibility, and engagement through strategic social media marketing and branding solutions.</p>
            </div>
            <div className="age-41">
              <div className="age-8">
                <ul className="age-42">
                  <li className="age-8">
                    <span className="age-8">Brand Identity Design</span>
                  </li>
                  <li className="age-8">
                    <div className="age-8">Social Media Management</div>
                  </li>
                  <li className="age-8">
                    <div className="age-8">Growth Strategy</div>
                  </li>
                </ul>
              </div>
            </div>
            <div className="age-16">
              <a className="age-22" href="#book-agency" data-book="agency:ag-marketing">
                <span className="age-23">
                  <span className="age-24">Consult With Us</span>
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
