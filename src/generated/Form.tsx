import { StepForm } from '../components/StepForm'
import { enquiryForm } from '../components/formDefs'
import './form.css'



export default function Form() {
  return (
    <div className="for-1">
      <div className="for-2">
        <div className="for-3">
          <div className="for-4">
            <div className="for-5">
              <h2 className="for-6">General Inquiries</h2>
            </div>
            <div className="for-5">
              <h2 className="for-7">Service Form</h2>
            </div>
            <div className="for-8">
              <div className="for-9">
                <span className="for-10"></span>
              </div>
            </div>
            <div className="for-11">
              <p className="for-12">Please fill out the form below and a member of our creative team will get back to you within one business day.</p>
            </div>
          </div>
        </div>
      </div>
      <div className="for-13">
        <div className="for-14">
          <div className="for-15">
            <div className="for-16">
              <div className="for-17">
                <StepForm def={enquiryForm} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
