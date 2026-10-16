import { A } from '../components/A'
import { BackgroundSlideshow } from '../components/BackgroundSlideshow'
import { Gallery } from '../components/Gallery'
import { TestimonialSlider } from '../components/TestimonialSlider'
import { useContent, toGallery } from '../cms/content'
import { homeGallery, homeHero, homeTestimonials } from '../cms/builtin'
import './home.css'



export default function Home() {
  const cms = useContent()
  const heroImgs = cms?.images['home-hero']?.length ? cms.images['home-hero'].map((i) => i.url) : homeHero
  const galManaged = !!cms?.images['home-gallery']?.length
  const galleryImgs = galManaged ? toGallery(cms!.images['home-gallery']) : homeGallery
  const testimonials = cms?.testimonials?.length ? cms.testimonials.map((t) => ({ quote: t.quote, author: t.author, role: t.role })) : homeTestimonials
  return (
    <div className="hom-1">
      <div className="hom-2">
        <div className="hom-3">
          <div className="hom-4">
            <div className="hom-5">
              <h2 className="hom-6">Full-Service Media Agency</h2>
            </div>
            <div className="hom-7">
              <h2 className="hom-8">
                {"Creating Visual Stories That Leave "}
                <br className="hom-9" />
                Lasting Impressions
              </h2>
            </div>
            <div className="hom-10">
              <p className="hom-11">IlluszionzMedia is a full-service media company delivering world-class photography, videography, creative consulting, and media training transforming moments, brands, and ideas into powerful visual experiences.</p>
            </div>
            <div className="hom-12">
              <div className="hom-7">
                <A className="hom-13" href="/photography-services/">
                  <span className="hom-14">
                    <span className="hom-15">
                      <svg className="hom-16" aria-hidden="true" viewBox="0 0 448 512">
                        <path d="M190.5 66.9l22.2-22.2c9.4-9.4 24.6-9.4 33.9 0L441 239c9.4 9.4 9.4 24.6 0 33.9L246.6 467.3c-9.4 9.4-24.6 9.4-33.9 0l-22.2-22.2c-9.5-9.5-9.3-25 .4-34.3L311.4 296H24c-13.3 0-24-10.7-24-24v-32c0-13.3 10.7-24 24-24h287.4L190.9 101.2c-9.8-9.3-10-24.8-.4-34.3z" />
                      </svg>
                    </span>
                    <span className="hom-17">View Our Work</span>
                  </span>
                </A>
              </div>
              <div className="hom-7">
                <A className="hom-18" href="/form/">
                  <span className="hom-19">
                    <span className="hom-20">Consult with Us</span>
                  </span>
                </A>
              </div>
            </div>
          </div>
          <div className="hom-21">
            <BackgroundSlideshow images={heroImgs} duration={5000} transition={500} />
          </div>
        </div>
      </div>
      <div className="hom-22">
        <div className="hom-23">
          <div className="hom-24">
            <h2 className="hom-25">Who We Are</h2>
          </div>
          <div className="hom-26">
            <h2 className="hom-27">IlluszionzMedia is a creative media company passionate about storytelling through visuals.</h2>
          </div>
          <div className="hom-28">
            <p className="hom-11">From stunning photography and cinematic videography to creative consulting and professional training, we help individuals, brands, and organizations bring their vision to life.</p>
          </div>
          <div className="hom-29">
            <A className="hom-30" href="/about-us/">
              <span className="hom-19">
                <span className="hom-31">Learn More About Us</span>
              </span>
            </A>
          </div>
        </div>
      </div>
      <div className="hom-32">
        <div className="hom-33">
          <div className="hom-7">
            <div className="hom-34">
              <A className="hom-35 svc-link" href="/photography-services/">
                <div className="hom-36">
                  <svg className="hom-37" fill="none" viewBox="0 0 24 24" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h3l2-3h8l2 3h3v12H3V7z" />
                    <circle cx="12" cy="13" r="3.5" />
                  </svg>
                </div>
                <div className="hom-38">PHOTOGRAPHY</div>
                <div className="hom-39">Professional visual and creative solutions tailored to your needs.</div>
              </A>
              <A className="hom-35 svc-link" href="/videography-services/">
                <div className="hom-36">
                  <svg className="hom-37" fill="none" viewBox="0 0 24 24" strokeWidth="1.8">
                    <rect x="3" y="7" width="13" height="10" rx="2" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 10l5-3v10l-5-3" />
                  </svg>
                </div>
                <div className="hom-38">VIDEOGRAPHY</div>
                <div className="hom-39">Professional visual and creative solutions tailored to your needs.</div>
              </A>
              <A className="hom-35 svc-link" href="/agency/">
                <div className="hom-36">
                  <svg className="hom-37" fill="none" viewBox="0 0 24 24" strokeWidth="1.8">
                    <rect x="3" y="7" width="18" height="13" rx="2" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 7V5h6v2" />
                  </svg>
                </div>
                <div className="hom-38">CREATIVE AGENCY</div>
                <div className="hom-39">Professional visual and creative solutions tailored to your needs.</div>
              </A>
              <A className="hom-35 svc-link" href="/academy/">
                <div className="hom-36">
                  <svg className="hom-37" fill="none" viewBox="0 0 24 24" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10l9-5 9 5-9 5-9-5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v5" />
                  </svg>
                </div>
                <div className="hom-38">ACADEMY</div>
                <div className="hom-39">Professional visual and creative solutions tailored to your needs.</div>
              </A>
              <A className="hom-35 svc-link" href="/store/">
                <div className="hom-36">
                  <svg className="hom-37" fill="none" viewBox="0 0 24 24" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 7l1-3h10l1 3" />
                    <rect x="5" y="7" width="14" height="13" rx="2" />
                  </svg>
                </div>
                <div className="hom-38">STORE</div>
                <div className="hom-39">Professional visual and creative solutions tailored to your needs.</div>
              </A>
            </div>
          </div>
        </div>
      </div>
      <div className="hom-40">
        <div className="hom-41">
          <div className="hom-42">
            <div className="hom-7">
              <h2 className="hom-43">Excellence Guaranteed</h2>
            </div>
            <div className="hom-44">
              <h2 className="hom-45">
                Why Choose
                <br className="hom-9" />
                IlluszionzMedia
              </h2>
            </div>
            <div className="hom-46">
              <p className="hom-11">We combine creativity, strategy, and technical excellence to deliver media solutions that stand out and leave lasting impressions. Every project is an opportunity to innovate and inspire.</p>
            </div>
          </div>
          <div className="hom-47">
            <div className="hom-7">
              <div className="hom-48">
                <div className="hom-49">
                  <span className="hom-50">
                    <svg className="hom-51" aria-hidden="true" viewBox="0 0 512 512">
                      <path d="M173.898 439.404l-166.4-166.4c-9.997-9.997-9.997-26.206 0-36.204l36.203-36.204c9.997-9.998 26.207-9.998 36.204 0L192 312.69 432.095 72.596c9.997-9.997 26.207-9.997 36.204 0l36.203 36.204c9.997 9.997 9.997 26.206 0 36.204l-294.4 294.401c-9.998 9.997-26.207 9.997-36.204-.001z" />
                    </svg>
                  </span>
                </div>
                <div className="hom-52">
                  <p className="hom-53">Experienced Creative Professionals</p>
                </div>
              </div>
            </div>
            <div className="hom-7">
              <div className="hom-48">
                <div className="hom-49">
                  <span className="hom-50">
                    <svg className="hom-51" aria-hidden="true" viewBox="0 0 512 512">
                      <path d="M173.898 439.404l-166.4-166.4c-9.997-9.997-9.997-26.206 0-36.204l36.203-36.204c9.997-9.998 26.207-9.998 36.204 0L192 312.69 432.095 72.596c9.997-9.997 26.207-9.997 36.204 0l36.203 36.204c9.997 9.997 9.997 26.206 0 36.204l-294.4 294.401c-9.998 9.997-26.207 9.997-36.204-.001z" />
                    </svg>
                  </span>
                </div>
                <div className="hom-52">
                  <p className="hom-53">Industry-Standard Equipment</p>
                </div>
              </div>
            </div>
            <div className="hom-7">
              <div className="hom-48">
                <div className="hom-49">
                  <span className="hom-50">
                    <svg className="hom-51" aria-hidden="true" viewBox="0 0 512 512">
                      <path d="M173.898 439.404l-166.4-166.4c-9.997-9.997-9.997-26.206 0-36.204l36.203-36.204c9.997-9.998 26.207-9.998 36.204 0L192 312.69 432.095 72.596c9.997-9.997 26.207-9.997 36.204 0l36.203 36.204c9.997 9.997 9.997 26.206 0 36.204l-294.4 294.401c-9.998 9.997-26.207 9.997-36.204-.001z" />
                    </svg>
                  </span>
                </div>
                <div className="hom-52">
                  <p className="hom-53">Tailored Client Solutions</p>
                </div>
              </div>
            </div>
            <div className="hom-7">
              <div className="hom-48">
                <div className="hom-49">
                  <span className="hom-50">
                    <svg className="hom-51" aria-hidden="true" viewBox="0 0 512 512">
                      <path d="M173.898 439.404l-166.4-166.4c-9.997-9.997-9.997-26.206 0-36.204l36.203-36.204c9.997-9.998 26.207-9.998 36.204 0L192 312.69 432.095 72.596c9.997-9.997 26.207-9.997 36.204 0l36.203 36.204c9.997 9.997 9.997 26.206 0 36.204l-294.4 294.401c-9.998 9.997-26.207 9.997-36.204-.001z" />
                    </svg>
                  </span>
                </div>
                <div className="hom-52">
                  <p className="hom-53">{"Reliable & Professional Delivery"}</p>
                </div>
              </div>
            </div>
            <div className="hom-7">
              <div className="hom-48">
                <div className="hom-49">
                  <span className="hom-50">
                    <svg className="hom-51" aria-hidden="true" viewBox="0 0 512 512">
                      <path d="M173.898 439.404l-166.4-166.4c-9.997-9.997-9.997-26.206 0-36.204l36.203-36.204c9.997-9.998 26.207-9.998 36.204 0L192 312.69 432.095 72.596c9.997-9.997 26.207-9.997 36.204 0l36.203 36.204c9.997 9.997 9.997 26.206 0 36.204l-294.4 294.401c-9.998 9.997-26.207 9.997-36.204-.001z" />
                    </svg>
                  </span>
                </div>
                <div className="hom-52">
                  <p className="hom-53">Creative Excellence</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="hom-32">
        <div className="hom-54">
          <div className="hom-7">
            <h2 className="hom-25">Our Portfolio</h2>
          </div>
          <div className="hom-55">
            <div className="hom-56">
              <h2 className="hom-57">Featured Works</h2>
            </div>
            <div className="hom-7">
              <A className="hom-58" href="/media/">
                <span className="hom-19">
                  <span className="hom-31">View Full Portfolio</span>
                </span>
              </A>
            </div>
          </div>
          <Gallery images={galleryImgs} columns={[3, 2, 2]} gap={10} placement={galManaged ? undefined : [[0,1,2,0,1,2,0,1,2,0,1,2,0,1,2,1,0,2,1,0,2,0,1,0,2,1,0,2,1,2],[0,1,0,1,1,0,1,0,1,0,1,0,1,0,0,1,1,0,1,0,0,1,1,1,0,1,0,1,0,1],[0,1,0,1,1,0,1,0,1,0,1,0,1,0,0,1,1,0,1,0,0,1,1,1,0,1,0,1,0,1]]} className="hom-7" />
        </div>
      </div>
      <div className="hom-59">
        <div className="hom-60">
          <div className="hom-7">
            <div className="hom-61">
              <div className="hom-62">
                <svg className="hom-63" aria-hidden="true" viewBox="0 0 512 512">
                  <path d="M464 32H336c-26.5 0-48 21.5-48 48v128c0 26.5 21.5 48 48 48h80v64c0 35.3-28.7 64-64 64h-8c-13.3 0-24 10.7-24 24v48c0 13.3 10.7 24 24 24h8c88.4 0 160-71.6 160-160V80c0-26.5-21.5-48-48-48zm-288 0H48C21.5 32 0 53.5 0 80v128c0 26.5 21.5 48 48 48h80v64c0 35.3-28.7 64-64 64h-8c-13.3 0-24 10.7-24 24v48c0 13.3 10.7 24 24 24h8c88.4 0 160-71.6 160-160V80c0-26.5-21.5-48-48-48z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="hom-71">
            <TestimonialSlider items={testimonials} cls={{"section":"hom-9","container":"hom-64","content":"hom-65","quote":"hom-66","author":"hom-67","role":"hom-68","controls":"hom-69","prev":"hom-70","next":"hom-70"}} />
          </div>
        </div>
      </div>
      <div className="hom-72">
        <div className="hom-73">
          <div className="hom-74">
            <div className="hom-7">
              <h2 className="hom-75">Let’s Connect</h2>
            </div>
          </div>
          <div className="hom-76">
            <div className="hom-77">
              <p className="hom-11">I look forward to hearing from you and helping you create memories that will last a lifetime.</p>
            </div>
            <div className="hom-7">
              <A className="hom-78" href="/contact/">
                <span className="hom-79">
                  <span className="hom-15">
                    <svg className="hom-80" aria-hidden="true" viewBox="0 0 256 512">
                      <path d="M224.3 273l-136 136c-9.4 9.4-24.6 9.4-33.9 0l-22.6-22.6c-9.4-9.4-9.4-24.6 0-33.9l96.4-96.4-96.4-96.4c-9.4-9.4-9.4-24.6 0-33.9L54.3 103c9.4-9.4 24.6-9.4 33.9 0l136 136c9.5 9.4 9.5 24.6.1 34z" />
                    </svg>
                  </span>
                  <span className="hom-31">Get In Touch</span>
                </span>
              </A>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
