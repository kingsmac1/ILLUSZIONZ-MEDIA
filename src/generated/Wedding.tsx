import { Gallery } from '../components/Gallery'
import { BookableGrid, BookNow } from '../components/BookableGrid'
import { useContent, toGallery } from '../cms/content'
import { weddingGallery } from '../cms/builtin'
import './wedding.css'


export default function Wedding() {
  const cms = useContent()
  const galManaged = !!cms?.images['wedding-gallery']?.length
  const galleryImgs = galManaged ? toGallery(cms!.images['wedding-gallery']) : weddingGallery
  return (
    <div className="wed-1">
      <div className="wed-2">
        <div className="wed-3">
          <div className="wed-4">
            <div className="wed-5">
              <h2 className="wed-6">Ethereal Memories</h2>
            </div>
            <div className="wed-5">
              <h2 className="wed-7">
                Wedding Photography
                <br className="wed-8" />
                {" Services"}
              </h2>
            </div>
            <div className="wed-9">
              <div className="wed-10">
                <span className="wed-11"></span>
              </div>
            </div>
            <div className="wed-12">
              <p className="wed-13">Preserving the raw emotions and timeless elegance of your union. We specialize in cinematic storytelling and editorial wedding imagery for the modern couple.</p>
            </div>
          </div>
        </div>
      </div>
      <div className="sc-section">
        <div className="sc-section-inner">
          <BookableGrid id="book" columns={2} cards={[
  {
    "flowId": "wedding",
    "optionId": "wedding-silver",
    "title": "Silver Package",
    "image": "/images/imgi_13_325350223_167249076020601_2069285591843222161_n.jpg",
    "price": "£1,100",
    "priceNote": "8 hours",
    "bullets": [
      "All softcopies in Google Drive, downloadable",
      "All soft copies also on a Flash Drive",
      "A photo frame"
    ],
    "cta": "Book Silver"
  },
  {
    "flowId": "wedding",
    "optionId": "wedding-gold",
    "title": "Gold Package",
    "image": "/images/ILU6448.webp",
    "price": "£1,300",
    "priceNote": "10 hours",
    "bullets": [
      "All softcopies in Google Drive (downloadable)",
      "All softcopies in a customized webpage",
      "All soft copies on a Flash Drive",
      "1 look complimentary prewedding",
      "A mini photobook",
      "A wall frame"
    ],
    "cta": "Book Gold"
  },
  {
    "flowId": "wedding",
    "optionId": "wedding-diamond",
    "title": "Diamond Package",
    "image": "/images/ILU3195.webp",
    "price": "£1,700",
    "priceNote": "12 hours",
    "bullets": [
      "All pictures in Google Drive (downloadable)",
      "All softcopies in a customized webpage",
      "All soft copies on a Flash Drive",
      "2 hours complimentary prewedding",
      "2 wall frames",
      "A complimentary large photobook (200 pictures)",
      "Extra photographer"
    ],
    "cta": "Book Diamond"
  },
  {
    "flowId": "wedding",
    "optionId": "wedding-traditional",
    "title": "Traditional Weddings",
    "image": "/images/ILU6151.webp",
    "price": "£900",
    "priceNote": "8 hours",
    "bullets": [
      "Softcopies in Google Drive (downloadable)",
      "All soft copies on a Flash Drive",
      "All softcopies in a customized webpage"
    ],
    "cta": "Book Traditional"
  }
]}><div className="sc-extras">
            <h3>Add to any package</h3>
            <ul>
              <li><span>Extra photographer<small>up to 10 hours</small></span><b>£350</b></li>
              <li><span>Extra hours<small>per hour</small></span><b>£100</b></li>
              <li><span>Photobook package<small>depends on size</small></span><b>from £200</b></li>
              <li><span>Extra USB</span><b>£50</b></li>
              <li><span>Engagement look<small>3 hours · 3 outfits</small></span><b>£400</b></li>
            </ul>
          </div></BookableGrid>
        </div>
      </div>
      <div className="wed-29">
        <div className="wed-30">
          <div className="wed-31">
            <div className="wed-5">
              <h2 className="wed-6">Captured Moments</h2>
            </div>
            <div className="wed-5">
              <h2 className="wed-32">Featured Gallery</h2>
            </div>
            <div className="wed-33">
              <div className="wed-10">
                <span className="wed-34"></span>
              </div>
            </div>
          </div>
          <div className="wed-35">
            <Gallery images={galleryImgs} columns={[4, 2, 1]} gap={10} placement={galManaged ? undefined : [[0,1,2,3,0,3,2,1,0,3,2,1,0,1,3,2,3,0,1],[0,1,0,1,0,1,0,1,0,1,0,1,1,0,1,0,1,0,1],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]]} className="wed-16" />
          </div>
        </div>
      </div>
      <div className="wed-36">
        <div className="wed-37">
          <div className="wed-16">
            <div className="wed-38">
              <div className="wed-39">
                <svg className="wed-40" aria-hidden="true" viewBox="0 0 512 512">
                  <path d="M458.4 64.3C400.6 15.7 311.3 23 256 79.3 200.7 23 111.4 15.6 53.6 64.3-21.6 127.6-10.6 230.8 43 285.5l175.4 178.7c10 10.2 23.4 15.9 37.6 15.9 14.3 0 27.6-5.6 37.6-15.8L469 285.6c53.5-54.7 64.7-157.9-10.6-221.3zm-23.6 187.5L259.4 430.5c-2.4 2.4-4.4 2.4-6.8 0L77.2 251.8c-36.5-37.2-43.9-107.6 7.3-150.7 38.9-32.7 98.9-27.8 136.5 10.5l35 35.7 35-35.7c37.8-38.5 97.8-43.2 136.5-10.6 51.1 43.1 43.5 113.9 7.3 150.8z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="wed-5">
            <h2 className="wed-41">
              Let’s Tell Your Love
              <br className="wed-8" />
              {" Story"}
            </h2>
          </div>
          <div className="wed-42">
            <p className="wed-13">Dates for 2026 are filling up fast. Get in touch to secure your celebration.</p>
          </div>
          <div className="wed-43">
            <div className="wed-44" role="list">
              <span className="wed-45" role="listitem">
                <a className="wed-46" href="https://web.facebook.com/Illuszionzweddings" target="_blank">
                  <span className="wed-47">Facebook</span>
                  <svg className="wed-48" aria-hidden="true" viewBox="0 0 512 512">
                    <path d="M504 256C504 119 393 8 256 8S8 119 8 256c0 123.78 90.69 226.38 209.25 245V327.69h-63V256h63v-54.64c0-62.15 37-96.48 93.67-96.48 27.14 0 55.52 4.84 55.52 4.84v61h-31.28c-30.8 0-40.41 19.12-40.41 38.73V256h68.78l-11 71.69h-57.78V501C413.31 482.38 504 379.78 504 256z" />
                  </svg>
                </a>
              </span>
              {" "}
              <span className="wed-45" role="listitem">
                <a className="wed-46" href="https://wa.me/+447864748937" target="_blank">
                  <span className="wed-49">Whatsapp</span>
                  <svg className="wed-48" aria-hidden="true" viewBox="0 0 448 512">
                    <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
                  </svg>
                </a>
              </span>
              {" "}
              <span className="wed-45" role="listitem">
                <a className="wed-46" href="https://www.instagram.com/illuszionzweddings/" target="_blank">
                  <span className="wed-50">Instagram</span>
                  <svg className="wed-48" aria-hidden="true" viewBox="0 0 448 512">
                    <path d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z" />
                  </svg>
                </a>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
