import type { Field } from '../booking/catalog'
import { countries } from './countries'

/** A field in a stepped site form. Extends the booking Field with conditional display and a star rating style. */
export type FormField = Field & { showIf?: { field: string; equals: string }; rating?: boolean; hint?: string }
export type FormDef = {
  /** server template: functions/api/form.ts */
  key: 'contact' | 'enquiry' | 'review'
  eyebrow: string
  title: string
  steps: { id: string; title: string; blurb?: string; fields: FormField[] }[]
  submitLabel: string
  successTitle: string
  success: string
}

const name: FormField = { id: 'name', label: 'Name', type: 'text', required: true, half: true, autoComplete: 'name' }
const email: FormField = { id: 'email', label: 'Email', type: 'email', required: true, half: true, autoComplete: 'email' }

export const contactForm: FormDef = {
  key: 'contact',
  eyebrow: 'Contact',
  title: 'Send us a message',
  submitLabel: 'Send message',
  successTitle: 'Message sent',
  success: 'Thanks for contacting us! We will be in touch with you shortly.',
  steps: [
    { id: 'you', title: 'About you', blurb: 'So we know who to reply to.', fields: [name, email] },
    { id: 'msg', title: 'Your message', blurb: 'Tell us what you have in mind.', fields: [
      { id: 'subject', label: 'Subject', type: 'text' },
      { id: 'message', label: 'Comment or Message', type: 'textarea', placeholder: 'How can we help?' },
    ] },
  ],
}

export const reviewForm: FormDef = {
  key: 'review',
  eyebrow: 'Client reviews',
  title: 'Share your experience',
  submitLabel: 'Submit review',
  successTitle: 'Thank you for your review',
  success: 'Thanks for sharing your story! We read every review personally.',
  steps: [
    { id: 'rate', title: 'Your rating', blurb: 'How was working with us?', fields: [
      { id: 'rating', label: 'Overall Rating', type: 'chips', rating: true, required: true, options: ['1', '2', '3', '4', '5'] },
      { id: 'session', label: 'Session Type', type: 'select', options: ['Wedding', 'Portrait Photography', 'Videography', 'Careers', 'Agency', 'Academy', 'Store'] },
    ] },
    { id: 'story', title: 'Your story', blurb: 'A few words about your experience.', fields: [
      { id: 'name', label: 'Full Name', type: 'text', required: true, half: true, autoComplete: 'name' },
      { id: 'email', label: 'Email (optional)', type: 'email', half: true, autoComplete: 'email', hint: 'So we can say thank you.' },
      { id: 'story', label: 'Your Story', type: 'textarea', placeholder: 'What stood out for you?' },
    ] },
  ],
}

export const enquiryForm: FormDef = {
  key: 'enquiry',
  eyebrow: 'Service form',
  title: 'Tell us what you need',
  submitLabel: 'Submit enquiry',
  successTitle: 'Enquiry received',
  success: 'Thanks for contacting us! A member of our creative team will get back to you within one business day.',
  steps: [
    { id: 'you', title: 'About you', blurb: 'How should we reach you?', fields: [
      name, email,
      { id: 'phone', label: 'Phone', type: 'tel', required: true, placeholder: '+44 …', autoComplete: 'tel' },
    ] },
    { id: 'service', title: 'Your enquiry', blurb: 'Which service are you interested in?', fields: [
      { id: 'service', label: 'Service List', type: 'chips', required: true, options: ['Videography', 'Agency', 'Careers'] },
      { id: 'video', label: 'Videography Services', type: 'select', required: true, showIf: { field: 'service', equals: 'Videography' }, options: ['Wedding Videography', 'Drone Coverage', 'Live Streaming', 'Event Coverage', 'Reels, Podcast & Interview', 'Movie/Music Production', '360 Booth'] },
      { id: 'agency', label: 'Agency Services', type: 'select', required: true, showIf: { field: 'service', equals: 'Agency' }, options: ['Marketing & Branding', 'Location Scouting', 'Influencer Scouting & Liaison', 'Artist & Crew Scouting', 'Creative Crew Scouting', 'Movie Premiere Consulting', 'Creative Use Consultation', 'Sponsorship Consultation', 'Airport Welcome Paparazzi Crew'] },
      { id: 'career', label: 'Career', type: 'chips', required: true, showIf: { field: 'service', equals: 'Careers' }, options: ['Photographers', 'Videographers', 'Content Creators', 'Editors', 'Others'] },
      { id: 'other', label: 'Others', type: 'text', required: true, showIf: { field: 'career', equals: 'Others' }, placeholder: 'Tell us which role' },
    ] },
    { id: 'where', title: 'Where you are', blurb: 'Your address helps us plan travel and logistics.', fields: [
      { id: 'address', label: 'Address', type: 'text', required: true, autoComplete: 'street-address' },
      { id: 'city', label: 'City', type: 'text', required: true, half: true, autoComplete: 'address-level2' },
      { id: 'state', label: 'State / Province', type: 'text', required: true, half: true, autoComplete: 'address-level1' },
      { id: 'postal', label: 'Postal Code', type: 'text', required: true, half: true, autoComplete: 'postal-code' },
      { id: 'country', label: 'Country', type: 'select', required: true, half: true, options: countries },
    ] },
    { id: 'extra', title: 'Anything else', blurb: 'Optional — the more we know, the better we can help.', fields: [
      { id: 'notes', label: 'Extra Notes / Specific Requests', type: 'textarea' },
      { id: 'heard', label: 'How did you hear about us?', type: 'text', placeholder: 'Instagram, a friend, Google…' },
    ] },
  ],
}
