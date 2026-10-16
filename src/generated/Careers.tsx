import { CareersAccordion } from '../components/CareersAccordion'
import { A } from '../components/A'
import './careers.css'



export default function Careers() {
  return (
    <div className="car-1">
      <div className="car-2">
        <div className="car-3">
          <div className="car-4">
            <div className="car-5">
              <h2 className="car-6">Join the Collective</h2>
            </div>
            <div className="car-5">
              <h2 className="car-7">
                Careers at
                <br className="car-8" />
                IlluszionzMedia
              </h2>
            </div>
            <div className="car-9">
              <div className="car-10">
                <span className="car-11"></span>
              </div>
            </div>
            <div className="car-12">
              <p className="car-13">We are always on the lookout for visionary artists, technical masters, and creative thinkers who want to push the boundaries of visual storytelling.</p>
            </div>
          </div>
        </div>
      </div>
      <div className="car-14">
        <div className="car-15">
          <div className="car-16">
            <div className="car-17">
              <div className="car-18">
                <span className="car-19">
                  <svg className="car-20" aria-hidden="true" viewBox="0 0 512 512">
                    <path d="M464 128h-80V80c0-26.5-21.5-48-48-48H176c-26.5 0-48 21.5-48 48v48H48c-26.5 0-48 21.5-48 48v288c0 26.5 21.5 48 48 48h416c26.5 0 48-21.5 48-48V176c0-26.5-21.5-48-48-48zM192 96h128v32H192V96zm160 248c0 4.4-3.6 8-8 8h-56v56c0 4.4-3.6 8-8 8h-48c-4.4 0-8-3.6-8-8v-56h-56c-4.4 0-8-3.6-8-8v-48c0-4.4 3.6-8 8-8h56v-56c0-4.4 3.6-8 8-8h48c4.4 0 8 3.6 8 8v56h56c4.4 0 8 3.6 8 8v48z" />
                  </svg>
                </span>
              </div>
              <div className="car-21">
                <p className="car-22">Open Roles</p>
              </div>
            </div>
          </div>
          <div className="car-23">
            <CareersAccordion items={[{"title":"Photographers","meta":"GLOBAL / REMOTE    CONTRACT / FULL-TIME","text":"We are seeking visionary photographers with a sharp eye for detail and a mastery of light. You should have experience in either high-end fashion, commercial branding, or cinematic portraits. Proficiency in Adobe Lightroom and Photoshop is essential.","open":true},{"title":"Videographers","meta":"IN-STUDIO / ON-LOCATION    FULL-TIME","text":"We are looking for videographers with strong storytelling, editing, and production skills to create cinematic brand films and digital campaigns."},{"title":"Content Creators","meta":"HYBRID    CONTRACT","text":"Seeking creators who can produce engaging digital content across social platforms and marketing campaigns."},{"title":"Editors","meta":"REMOTE    FULL-TIME","text":"Editors with a strong eye for pacing, rhythm, storytelling, and visual consistency across brand and cinematic projects."}]} />
          </div>
        </div>
      </div>
      <div className="car-24">
        <div className="car-25">
          <div className="car-23">
            <h2 className="car-26">Don't see a perfect fit?</h2>
          </div>
          <div className="car-27">
            <p className="car-13">We’re always open to meeting extraordinary talent. Send us your portfolio and tell us why you’d be a great addition to our team.</p>
          </div>
          <div className="car-23">
            <A className="car-28" href="/form/">
              <span className="car-29">
                <span className="car-30">
                  <svg className="car-31" aria-hidden="true" viewBox="0 0 448 512">
                    <path d="M190.5 66.9l22.2-22.2c9.4-9.4 24.6-9.4 33.9 0L441 239c9.4 9.4 9.4 24.6 0 33.9L246.6 467.3c-9.4 9.4-24.6 9.4-33.9 0l-22.2-22.2c-9.5-9.5-9.3-25 .4-34.3L311.4 296H24c-13.3 0-24-10.7-24-24v-32c0-13.3 10.7-24 24-24h287.4L190.9 101.2c-9.8-9.3-10-24.8-.4-34.3z" />
                  </svg>
                </span>
                <span className="car-32">APPLY NOW</span>
              </span>
            </A>
          </div>
          <div className="car-23">
            <h2 className="car-33">Email: info@illuszionzmedia.com</h2>
          </div>
        </div>
      </div>
    </div>
  )
}
