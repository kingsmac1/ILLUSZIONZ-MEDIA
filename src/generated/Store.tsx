
import { BookableGrid, BookNow } from '../components/BookableGrid'
import { useContent } from '../cms/content'
import { builtinStore } from '../cms/builtin'
import './store.css'



export default function Store() {
  const cms = useContent()
  const products = cms?.store?.length ? cms.store : builtinStore
  const cards = products.map((p) => ({
    flowId: p.flow_id,
    optionId: p.option_id || undefined,
    title: p.title,
    image: p.image_url || undefined,
    price: p.price || undefined,
    priceNote: p.price_note || undefined,
    description: p.description || undefined,
    bullets: p.bullets?.length ? p.bullets : undefined,
    cta: p.cta || 'Buy now',
    href: p.flow_id ? undefined : p.buy_url || undefined,
  }))
  return (
    <div className="sto-1">
      <div className="sto-2">
        <div className="sto-3">
          <div className="sto-4">
            <div className="sto-5">
              <h2 className="sto-6">Curated Resources</h2>
            </div>
            <div className="sto-7">
              <h2 className="sto-8">IlluszionzMedia Store</h2>
            </div>
            <div className="sto-9">
              <div className="sto-10">
                <span className="sto-11"></span>
              </div>
            </div>
            <div className="sto-12">
              <p className="sto-13">Creative resources, digital tools, and media essentials curated for creators. Elevate your craft with our professional-grade assets.</p>
            </div>
          </div>
        </div>
      </div>
      <div className="sc-section">
        <div className="sc-section-inner">
          <BookableGrid id="store" columns={2} cards={cards}></BookableGrid>
        </div>
      </div>
    </div>
  )
}
