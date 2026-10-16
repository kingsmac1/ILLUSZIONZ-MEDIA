import { A } from '../components/A'
import './media.css'



export default function Media() {
  return (
    <div className="med-1">
      <div className="med-2">
        <div className="med-3">
          <div className="med-4">
            <h2 className="med-5">Our Divisions</h2>
          </div>
          <div className="med-4">
            <h2 className="med-6">Media Collective</h2>
          </div>
          <div className="med-7">
            <h2 className="med-8">Select a division below to explore our specialized creative services and portfolios.</h2>
          </div>
        </div>
      </div>
      <div className="med-9">
        <div className="med-10">
          <div className="med-11">
            <div className="med-12">
              <div className="med-13">
                <A className="med-14" href="/photography-services/">
                  <div className="med-15">
                    <div className="med-16">
                      <div className="med-17">
                        <svg className="med-18" width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M4 7h3l2-3h6l2 3h3v12H4V7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                          <circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                      </div>
                      <img className="med-19" src="/images/pexels-nguy-n-ti-n-th-nh-2150376175-33072063-scaled.jpg" alt="Photography Portfolio" />
                    </div>
                    <div className="med-20">
                      <div className="med-21">
                        <h2 className="med-22">Photography Services</h2>
                        <span className="med-23">→</span>
                      </div>
                      <p className="med-24">Our photography services encompass high-end studio sessions, fashion editorials, and commercial branding. We focus on technical precision and creative expression to deliver imagery that stands out and tells a compelling story.</p>
                      <span className="med-25">View Division</span>
                    </div>
                  </div>
                </A>
                <A className="med-14" href="/videography-services/">
                  <div className="med-15">
                    <div className="med-16">
                      <div className="med-17">
                        <svg className="med-18" width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M23 7l-7 5 7 5V7z" fill="currentColor" />
                          <rect x="1" y="5" width="15" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
                        </svg>
                      </div>
                      <img className="med-19" src="/images/Photography-and-Videography-Services-in-Prescott-Arizona.webp" alt="Videography Portfolio" />
                    </div>
                    <div className="med-20">
                      <div className="med-21">
                        <h2 className="med-22">Videography Services</h2>
                        <span className="med-23">→</span>
                      </div>
                      <p className="med-24">We provide professional videography solutions ranging from cinematic brand films to comprehensive event coverage. Our team manages the entire process from conceptualization to final cut, ensuring high-impact visual narratives.</p>
                      <span className="med-25">View Division</span>
                    </div>
                  </div>
                </A>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
