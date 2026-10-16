import { BookableGrid, BookNow } from '../components/BookableGrid'
import './photography-services.css'



export default function PhotographyServices() {
  return (
    <div className="pho-1">
      <div className="pho-2">
        <div className="pho-3">
          <div className="pho-4">
            <h2 className="pho-5">Specialized Imagery</h2>
          </div>
          <div className="pho-4">
            <h2 className="pho-6">
              {"Portrait Photography "}
              <br className="pho-7" />
              {" Services"}
            </h2>
          </div>
          <div className="pho-8">
            <div className="pho-9">
              <span className="pho-10"></span>
            </div>
          </div>
          <div className="pho-11">
            <p className="pho-12">We capture moments, emotions, and brand identity through creative and professional photography services. Our approach combines artistic vision with technical mastery to produce visuals that endure.</p>
          </div>
        </div>
      </div>
      <div className="sc-section">
        <div className="sc-section-inner">
          <BookableGrid id="book" columns={3} cards={[
  {
    "flowId": "portrait",
    "optionId": "portrait-1",
    "title": "Portrait Photography",
    "image": "/images/imgi_18_591140939_18544250149022665_4243811256061463776_n.jpg",
    "fromLabel": "From",
    "price": "£170",
    "rows": [
      {
        "label": "1 Look",
        "note": "4 edited pictures",
        "price": "£170",
        "optionId": "portrait-1"
      },
      {
        "label": "2 Looks",
        "note": "8 edited pictures",
        "price": "£300",
        "optionId": "portrait-2"
      }
    ],
    "cta": "Book this shoot"
  },
  {
    "flowId": "maternity",
    "optionId": "maternity-1",
    "title": "Maternity Photography",
    "image": "/images/imgi_19_419535905_1050178712906946_6381751784486071102_n.jpg",
    "fromLabel": "From",
    "price": "£170",
    "rows": [
      {
        "label": "1 Look",
        "note": "4 edited pictures",
        "price": "£170",
        "optionId": "maternity-1"
      },
      {
        "label": "Couple · 1 Look",
        "note": "6 edited pictures",
        "price": "£200",
        "optionId": "maternity-couple"
      }
    ],
    "cta": "Book this shoot"
  },
  {
    "flowId": "baby",
    "optionId": "baby-1",
    "title": "Baby Shoot",
    "image": "/images/imgi_21_446468227_1194906268165586_3622239586575587069_n.jpg",
    "fromLabel": "From",
    "price": "£150",
    "rows": [
      {
        "label": "1 Look",
        "note": "4 edited pictures",
        "price": "£150",
        "optionId": "baby-1"
      },
      {
        "label": "2 Looks",
        "note": "8 edited pictures",
        "price": "£250",
        "optionId": "baby-2"
      }
    ],
    "cta": "Book this shoot"
  },
  {
    "flowId": "prewedding",
    "optionId": "prewedding-1",
    "title": "Prewedding / Engagement Pictures",
    "image": "/images/ILU6448-1.webp",
    "fromLabel": "From",
    "price": "£200",
    "rows": [
      {
        "label": "1 Look",
        "note": "7 images per look",
        "price": "£200",
        "optionId": "prewedding-1"
      },
      {
        "label": "2 Looks",
        "price": "£400",
        "optionId": "prewedding-2"
      },
      {
        "label": "3 Looks",
        "price": "£500",
        "optionId": "prewedding-3"
      }
    ],
    "cta": "Book this shoot"
  },
  {
    "flowId": "events",
    "optionId": "events-hourly",
    "title": "Events Photography",
    "image": "/images/imgi_15_447522866_977681870302310_4655339828997709344_n.jpg",
    "fromLabel": "From",
    "price": "£150",
    "priceNote": "per hour",
    "description": "Naming ceremonies, birthday parties and more. Discount considered on multiple hours.",
    "rows": [
      {
        "label": "Event coverage",
        "note": "3 hours minimum · within London",
        "price": "£150/hr",
        "optionId": "events-hourly"
      }
    ],
    "cta": "Book this event"
  },
  {
    "flowId": "family",
    "optionId": "family-look",
    "title": "Family Photo Sessions",
    "image": "/images/ILU6185.webp",
    "fromLabel": "From",
    "price": "£250",
    "priceNote": "per look",
    "rows": [
      {
        "label": "Family of 4",
        "note": "7 pictures per look",
        "price": "£250",
        "optionId": "family-look"
      },
      {
        "label": "Extra person",
        "price": "£20 each"
      }
    ],
    "cta": "Book this shoot"
  }
]}></BookableGrid>
        </div>
      </div>
      <div className="pho-27">
        <div className="pho-28">
          <div className="pho-4">
            <h2 className="pho-29">{"Terms & Conditions"}</h2>
          </div>
          <div className="pho-30">
            <div className="pho-31">
              <span className="pho-32"></span>
            </div>
          </div>
          <div className="pho-33">
            <div className="pho-34">
              <div className="pho-15">
                <div className="pho-35">
                  <div className="pho-36">
                    <span className="pho-37">
                      <svg className="pho-38" aria-hidden="true" viewBox="0 0 512 512">
                        <path d="M464 64H48C21.49 64 0 85.49 0 112v288c0 26.51 21.49 48 48 48h416c26.51 0 48-21.49 48-48V112c0-26.51-21.49-48-48-48zm0 48v40.805c-22.422 18.259-58.168 46.651-134.587 106.49-16.841 13.247-50.201 45.072-73.413 44.701-23.208.375-56.579-31.459-73.413-44.701C106.18 199.465 70.425 171.067 48 152.805V112h416zM48 400V214.398c22.914 18.251 55.409 43.862 104.938 82.646 21.857 17.205 60.134 55.186 103.062 54.955 42.717.231 80.509-37.199 103.053-54.947 49.528-38.783 82.032-64.401 104.947-82.653V400H48z" />
                      </svg>
                    </span>
                  </div>
                  <div className="pho-39">
                    <h3 className="pho-40">
                      <span className="pho-7">{"Delivery & Formats"}</span>
                    </h3>
                  </div>
                </div>
              </div>
              <div className="pho-41">
                <p className="pho-12">
                  {"All pictures are delivered in soft copies via "}
                  <strong className="pho-19">
                    <span className="pho-42">
                      <span className="pho-19">Email (Google Drive)</span>
                      {", "}
                      <span className="pho-19">WhatsApp document</span>
                    </span>
                  </strong>
                  , or for events, via a custom web gallery.
                </p>
              </div>
              <div className="pho-43">
                <p className="pho-12">Frames, USB, and photobooks are available on request at additional charges.</p>
              </div>
            </div>
            <div className="pho-44">
              <div className="pho-15">
                <div className="pho-35">
                  <div className="pho-36">
                    <span className="pho-37">
                      <svg className="pho-38" aria-hidden="true" viewBox="0 0 512 512">
                        <path d="M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8zm0 448c-110.5 0-200-89.5-200-200S145.5 56 256 56s200 89.5 200 200-89.5 200-200 200zm61.8-104.4l-84.9-61.7c-3.1-2.3-4.9-5.9-4.9-9.7V116c0-6.6 5.4-12 12-12h32c6.6 0 12 5.4 12 12v141.7l66.8 48.6c5.4 3.9 6.5 11.4 2.6 16.8L334.6 349c-3.9 5.3-11.4 6.5-16.8 2.6z" />
                      </svg>
                    </span>
                  </div>
                  <div className="pho-39">
                    <h3 className="pho-40">
                      <span className="pho-7">Punctuality Policy</span>
                    </h3>
                  </div>
                </div>
              </div>
              <div className="pho-45">
                <div className="pho-46">
                  <p className="pho-12">All appointments are strictly by time slot. Lateness may attract extra charges or cancellation.</p>
                </div>
              </div>
              <div className="pho-41">
                <p className="pho-12">Extra hours are to be paid immediately. Clients are also required to pay all studio rental fees where applicable.</p>
              </div>
            </div>
            <div className="pho-47">
              <div className="pho-15">
                <div className="pho-35">
                  <div className="pho-36">
                    <span className="pho-37">
                      <svg className="pho-38" aria-hidden="true" viewBox="0 0 576 512">
                        <path d="M527.9 32H48.1C21.5 32 0 53.5 0 80v352c0 26.5 21.5 48 48.1 48h479.8c26.6 0 48.1-21.5 48.1-48V80c0-26.5-21.5-48-48.1-48zM54.1 80h467.8c3.3 0 6 2.7 6 6v42H48.1V86c0-3.3 2.7-6 6-6zm467.8 352H54.1c-3.3 0-6-2.7-6-6V256h479.8v170c0 3.3-2.7 6-6 6zM192 332v40c0 6.6-5.4 12-12 12h-72c-6.6 0-12-5.4-12-12v-40c0-6.6 5.4-12 12-12h72c6.6 0 12 5.4 12 12zm192 0v40c0 6.6-5.4 12-12 12H236c-6.6 0-12-5.4-12-12v-40c0-6.6 5.4-12 12-12h136c6.6 0 12 5.4 12 12z" />
                      </svg>
                    </span>
                  </div>
                  <div className="pho-39">
                    <h3 className="pho-40">
                      <span className="pho-7">Payment Terms</span>
                    </h3>
                  </div>
                </div>
              </div>
              <div className="pho-41">
                <ul className="pho-48">
                  <li className="pho-19">
                    <span className="pho-42">
                      <strong className="pho-19">Single Outfit:</strong>
                    </span>
                    {" Full payment is required when booking."}
                  </li>
                  <li className="pho-19">
                    <div className="pho-19">
                      <span className="pho-42">
                        <strong className="pho-19">Multiple Outfits:</strong>
                      </span>
                      {" 80% deposit to secure booking."}
                    </div>
                  </li>
                  <li className="pho-19">
                    <div className="pho-19">Remaining balance must be paid immediately after the shoot.</div>
                  </li>
                  <li className="pho-19">
                    <span className="pho-42">
                      <strong className="pho-19">Studio Rental Fees:</strong>
                    </span>
                    <br className="pho-19" />
                    Clients are required to pay all studio rental fees.
                  </li>
                </ul>
              </div>
            </div>
            <div className="pho-49">
              <div className="pho-15">
                <div className="pho-35">
                  <div className="pho-36">
                    <span className="pho-37">
                      <svg className="pho-38" aria-hidden="true" viewBox="0 0 640 512">
                        <path d="M624 352h-16V243.9c0-12.7-5.1-24.9-14.1-33.9L494 110.1c-9-9-21.2-14.1-33.9-14.1H416V48c0-26.5-21.5-48-48-48H48C21.5 0 0 21.5 0 48v320c0 26.5 21.5 48 48 48h16c0 53 43 96 96 96s96-43 96-96h128c0 53 43 96 96 96s96-43 96-96h48c8.8 0 16-7.2 16-16v-32c0-8.8-7.2-16-16-16zM160 464c-26.5 0-48-21.5-48-48s21.5-48 48-48 48 21.5 48 48-21.5 48-48 48zm320 0c-26.5 0-48-21.5-48-48s21.5-48 48-48 48 21.5 48 48-21.5 48-48 48zm80-208H416V144h44.1l99.9 99.9V256z" />
                      </svg>
                    </span>
                  </div>
                  <div className="pho-39">
                    <h3 className="pho-40">
                      <span className="pho-7">{"Editing & Location"}</span>
                    </h3>
                  </div>
                </div>
              </div>
              <div className="pho-41">
                <p className="pho-12">
                  {"Delivery is "}
                  <strong className="pho-19">
                    <span className="pho-42">7–10 days</span>
                  </strong>
                  {" after selection. Edits are processed within 4–6 working days post-selection."}
                </p>
              </div>
              <div className="pho-50">
                <div className="pho-51">
                  <span className="pho-52"></span>
                </div>
              </div>
              <div className="pho-15">
                <h2 className="pho-53">Off-Site Policy</h2>
              </div>
              <div className="pho-54">
                <p className="pho-12">Off-site shoots attract extra charges depending on location distance.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="pho-27">
        <div className="pho-55">
          <div className="pho-56">
            <div className="pho-57">
              <h2 className="pho-58">ADDITIONAL INVESTMENT</h2>
              <div className="pho-59">
                <div className="pho-60">
                  <div className="pho-61">
                    <svg className="pho-62" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2L14 8L20 10L14 12L12 18L10 12L4 10L10 8L12 2Z" />
                    </svg>
                    <span className="pho-63">EXTRA EDITED IMAGES</span>
                  </div>
                  <span className="pho-64">£20 per image</span>
                </div>
                <div className="pho-60">
                  <div className="pho-61">
                    <svg className="pho-62" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7V12L15 15" />
                    </svg>
                    <span className="pho-63">DELAY FEE (PER 30 MINS)</span>
                  </div>
                  <span className="pho-64">£15</span>
                </div>
                <div className="pho-60">
                  <div className="pho-61">
                    <svg className="pho-62" viewBox="0 0 24 24" fill="none">
                      <path d="M13 2L3 14H11L9 22L21 10H13Z" />
                    </svg>
                    <span className="pho-63">24-HOUR EXPRESS TURNAROUND</span>
                  </div>
                  <span className="pho-64">£50</span>
                </div>
                <div className="pho-60">
                  <div className="pho-61">
                    <svg className="pho-62" viewBox="0 0 24 24" fill="none">
                      <path d="M13 2L3 14H11L9 22L21 10H13Z" />
                    </svg>
                    <span className="pho-63">48-HOUR EXPRESS TURNAROUND</span>
                  </div>
                  <span className="pho-64">£35</span>
                </div>
                <div className="pho-60">
                  <div className="pho-61">
                    <svg className="pho-62" viewBox="0 0 24 24" fill="none">
                      <circle cx="9" cy="9" r="3" />
                      <circle cx="15" cy="9" r="3" />
                      <path d="M3 20C3 16 9 14 12 14C15 14 21 16 21 20" />
                    </svg>
                    <span className="pho-63">ADDITIONAL PERSON IN FRAME</span>
                  </div>
                  <span className="pho-64">£40</span>
                </div>
                <div className="pho-60">
                  <div className="pho-61">
                    <svg className="pho-62" viewBox="0 0 24 24" fill="none">
                      <path d="M12 21S5 14.5 5 9.5A7 7 0 0119 9.5C19 14.5 12 21 12 21Z" />
                      <circle cx="12" cy="9.5" r="2.5" />
                    </svg>
                    <span className="pho-63">OUTDOOR LOGISTICS FEE</span>
                  </div>
                  <span className="pho-64">Based on distance</span>
                </div>
              </div>
            </div>
          </div>
          <div className="pho-65">
            <h2 className="pho-66">By booking a session, you agree to the above terms.</h2>
          </div>
        </div>
      </div>
      <div className="pho-67">
        <div className="pho-68">
          <div className="pho-69">
            <p className="pho-12">we accept, visa, mastercard, american express, discover, clearpay, klarna and all major credit cards</p>
          </div>
          <div className="pho-70">
            <div className="pho-71">
              <img className="pho-72" width={1117} height={498} src="/images/visa.png" alt="" />
            </div>
            <div className="pho-73">
              <img className="pho-74" width={844} height={571} src="/images/mastercard.png" alt="" />
            </div>
            <div className="pho-73">
              <img className="pho-75" width={1020} height={454} src="/images/american-ex.png" alt="" />
            </div>
            <div className="pho-71">
              <img className="pho-76" width={900} height={322} src="/images/discover.png" alt="" />
            </div>
            <div className="pho-73">
              <img className="pho-77" width={1052} height={288} src="/images/clearpay.png" alt="" />
            </div>
            <div className="pho-73">
              <img className="pho-78" width={980} height={436} src="/images/klarna.png" alt="" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
