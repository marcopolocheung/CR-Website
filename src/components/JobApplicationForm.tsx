'use client'
import { useState } from 'react'

type FormData = {
  // basic name and contact info
  lastName: string
  firstName: string
  middleName: string
  preferredName: string
  street: string
  city: string
  state: string
  zip: string
  phone: string
  email: string

  // job related fields what position and when
  positionDesired: string
  wageDesired: string
  startDate: string
  referredBy: string
  hasRelatives: string
  relativesWho: string
  workedHereBefore: string
  preferredLocation: string

  // eligibility questions the legal requirements
  is16OrOlder: string
  authorizedToWork: string
  canProvideProof: string
  foodHandlerCert: string

  // education history up to three schools
  education: Array<{
    school: string; city: string; state: string; major: string
    yearsAttended: string; degree: string; lastYear: string
  }>

  // work history up to three previous jobs
  workHistory: Array<{
    employer: string; title: string; startDate: string; endDate: string
    duties: string; reasonLeaving: string; supervisor: string
  }>

  // military service fields
  militaryServed: string
  militaryBranch: string
  militaryRank: string
  militaryDuties: string
  militaryFrom: string
  militaryTo: string
  militaryReasonLeaving: string
  militarySupervisor: string

  // the felony disclosure part
  felonyConviction: string
  felonyExplanation: string
  felonyWhen: string
}

const emptyEdu = () => ({ school: '', city: '', state: '', major: '', yearsAttended: '', degree: '', lastYear: '' })
const emptyWork = () => ({ employer: '', title: '', startDate: '', endDate: '', duties: '', reasonLeaving: '', supervisor: '' })

const initForm = (): FormData => ({
  lastName: '', firstName: '', middleName: '', preferredName: '',
  street: '', city: '', state: '', zip: '', phone: '', email: '',
  positionDesired: '', wageDesired: '', startDate: '', referredBy: '',
  hasRelatives: '', relativesWho: '', workedHereBefore: '', preferredLocation: '',
  is16OrOlder: '', authorizedToWork: '', canProvideProof: '', foodHandlerCert: '',
  education: [emptyEdu()],
  workHistory: [emptyWork()],
  militaryServed: '', militaryBranch: '', militaryRank: '', militaryDuties: '',
  militaryFrom: '', militaryTo: '', militaryReasonLeaving: '', militarySupervisor: '',
  felonyConviction: '', felonyExplanation: '', felonyWhen: '',
})

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 w-full'
const selectCls = inputCls

function SectionHeader({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-3 mt-8 mb-4">
      <span className="bg-red-700 text-white text-sm font-bold w-7 h-7 rounded-full flex items-center justify-center shrink-0">{n}</span>
      <h2 className="text-lg font-bold text-gray-800">{title}</h2>
    </div>
  )
}

const FILE_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.gif,.heic,application/pdf,image/*'
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic']

function validateFile(file: File): string {
  if (!ALLOWED_MIME.includes(file.type)) return 'Please upload a PDF or image file (JPG, PNG, WEBP, GIF, HEIC).'
  if (file.size > 10 * 1024 * 1024) return 'File must be under 10 MB.'
  return ''
}

function FileUpload({
  id, file, error, onChange, onClear, label,
}: {
  id: string; file: File | null; error: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onClear: () => void; label: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="flex items-center gap-3 border-2 border-dashed border-gray-300 hover:border-red-400 rounded-lg px-4 py-4 cursor-pointer transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <span className="text-sm text-gray-500">
          {file ? file.name : label}
        </span>
      </label>
      <input id={id} type="file" accept={FILE_ACCEPT} className="sr-only" onChange={onChange} />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {file && (
        <button type="button" className="text-xs text-gray-500 hover:text-red-600 self-start" onClick={onClear}>
          Remove file
        </button>
      )}
    </div>
  )
}

export default function JobApplicationForm() {
  const [form, setForm] = useState<FormData>(initForm())
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [resumeError, setResumeError] = useState('')
  const [foodHandlerFile, setFoodHandlerFile] = useState<File | null>(null)
  const [foodHandlerFileError, setFoodHandlerFileError] = useState('')

  const set = (field: keyof FormData, value: string) =>
    setForm(f => ({ ...f, [field]: value }))

  const makeFileHandler = (
    setFile: (f: File | null) => void,
    setError: (s: string) => void,
  ) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    if (!file) { setFile(null); setError(''); return }
    const err = validateFile(file)
    if (err) { setError(err); setFile(null); e.target.value = ''; return }
    setError('')
    setFile(file)
  }

  const handleResumeChange = makeFileHandler(setResumeFile, setResumeError)
  const handleFoodHandlerFileChange = makeFileHandler(setFoodHandlerFile, setFoodHandlerFileError)

  const setEdu = (i: number, field: keyof FormData['education'][0], value: string) =>
    setForm(f => {
      const education = [...f.education]
      education[i] = { ...education[i], [field]: value }
      return { ...f, education }
    })

  const setWork = (i: number, field: keyof FormData['workHistory'][0], value: string) =>
    setForm(f => {
      const workHistory = [...f.workHistory]
      workHistory[i] = { ...workHistory[i], [field]: value }
      return { ...f, workHistory }
    })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    // for now this just logs the form to console we should hook up an actual email service before launch
    console.log('Application submitted:', form, 'Resume:', resumeFile, 'Food Handler Cert:', foodHandlerFile)
    await new Promise(r => setTimeout(r, 800))
    setSubmitting(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
        <h2 className="text-2xl font-bold text-green-700 mb-2">Application Received!</h2>
        <p className="text-gray-600">Thank you for applying to China Rose. We&apos;ll review your application and reach out soon.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {/* section 1 basic information */}
      <SectionHeader n={1} title="Basic Information" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Last Name" required>
          <input className={inputCls} value={form.lastName} onChange={e => set('lastName', e.target.value)} required />
        </Field>
        <Field label="First Name" required>
          <input className={inputCls} value={form.firstName} onChange={e => set('firstName', e.target.value)} required />
        </Field>
        <Field label="Middle Name">
          <input className={inputCls} value={form.middleName} onChange={e => set('middleName', e.target.value)} />
        </Field>
      </div>
      <Field label="Preferred Name">
        <input className={inputCls} value={form.preferredName} onChange={e => set('preferredName', e.target.value)} />
      </Field>
      <Field label="Street Address" required>
        <input className={inputCls} value={form.street} onChange={e => set('street', e.target.value)} required />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="City" required>
          <input className={inputCls} value={form.city} onChange={e => set('city', e.target.value)} required />
        </Field>
        <Field label="State" required>
          <input className={inputCls} value={form.state} onChange={e => set('state', e.target.value)} required maxLength={2} placeholder="TX" />
        </Field>
        <Field label="Zip Code" required>
          <input className={inputCls} value={form.zip} onChange={e => set('zip', e.target.value)} required maxLength={10} />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Phone Number" required>
          <input className={inputCls} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} required />
        </Field>
        <Field label="Email Address">
          <input className={inputCls} type="email" value={form.email} onChange={e => set('email', e.target.value)} />
        </Field>
      </div>
      <Field label="Resume (optional)">
        <FileUpload
          id="resume-upload"
          file={resumeFile}
          error={resumeError}
          onChange={handleResumeChange}
          onClear={() => { setResumeFile(null); setResumeError('') }}
          label="Upload resume — PDF or image (JPG, PNG, WEBP, HEIC) · max 10 MB"
        />
      </Field>

      {/* section 2 job interest */}
      <SectionHeader n={2} title="Job Interest" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Position Desired" required>
          <input className={inputCls} value={form.positionDesired} onChange={e => set('positionDesired', e.target.value)} required />
        </Field>
        <Field label="Wage Desired">
          <input className={inputCls} value={form.wageDesired} onChange={e => set('wageDesired', e.target.value)} placeholder="e.g. $12/hr" />
        </Field>
        <Field label="Available Start Date" required>
          <input className={inputCls} type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} required />
        </Field>
        <Field label="Referred By">
          <input className={inputCls} value={form.referredBy} onChange={e => set('referredBy', e.target.value)} />
        </Field>
      </div>
      <Field label="Preferred Location" required>
        <select className={selectCls} value={form.preferredLocation} onChange={e => set('preferredLocation', e.target.value)} required>
          <option value="">Select a location</option>
          <option value="w-military">W Military Dr</option>
          <option value="sw-military">SW Military Dr</option>
          <option value="either">Either / No Preference</option>
        </select>
      </Field>
      <Field label="Do you have friends or relatives working here?">
        <select className={selectCls} value={form.hasRelatives} onChange={e => set('hasRelatives', e.target.value)}>
          <option value="">Select</option>
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>
      </Field>
      {form.hasRelatives === 'yes' && (
        <Field label="If yes, who?">
          <input className={inputCls} value={form.relativesWho} onChange={e => set('relativesWho', e.target.value)} />
        </Field>
      )}
      <Field label="Have you worked here before?">
        <select className={selectCls} value={form.workedHereBefore} onChange={e => set('workedHereBefore', e.target.value)}>
          <option value="">Select</option>
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>
      </Field>

      {/* section 3 eligibility */}
      <SectionHeader n={3} title="Eligibility" />
      <Field label="Are you 16 years of age or older?" required>
        <select className={selectCls} value={form.is16OrOlder} onChange={e => set('is16OrOlder', e.target.value)} required>
          <option value="">Select</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </Field>
      <Field label="Are you legally authorized to work in the United States?" required>
        <select className={selectCls} value={form.authorizedToWork} onChange={e => set('authorizedToWork', e.target.value)} required>
          <option value="">Select</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </Field>
      <Field label="If hired, can you provide proof of eligibility to work?" required>
        <select className={selectCls} value={form.canProvideProof} onChange={e => set('canProvideProof', e.target.value)} required>
          <option value="">Select</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </Field>
      <Field label="Do you have a valid Texas Food Handler Certification?" required>
        <select className={selectCls} value={form.foodHandlerCert} onChange={e => set('foodHandlerCert', e.target.value)} required>
          <option value="">Select</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </Field>
      {form.foodHandlerCert === 'yes' && (
        <div className="border border-green-200 bg-green-50 rounded-xl p-4 space-y-2">
          <p className="text-sm font-medium text-green-800">Upload your Texas Food Handler Certificate (optional but helpful)</p>
          <FileUpload
            id="food-handler-upload"
            file={foodHandlerFile}
            error={foodHandlerFileError}
            onChange={handleFoodHandlerFileChange}
            onClear={() => { setFoodHandlerFile(null); setFoodHandlerFileError('') }}
            label="Upload certificate — PDF or image (JPG, PNG, WEBP, HEIC) · max 10 MB"
          />
        </div>
      )}

      {/* section 4 education not sure evveryone will have multiple schools but we allow up to three */}
      <SectionHeader n={4} title="Education History" />
      {form.education.map((edu, i) => (
        <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-600">Institution {i + 1}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="School Name">
              <input className={inputCls} value={edu.school} onChange={e => setEdu(i, 'school', e.target.value)} />
            </Field>
            <Field label="City">
              <input className={inputCls} value={edu.city} onChange={e => setEdu(i, 'city', e.target.value)} />
            </Field>
            <Field label="State">
              <input className={inputCls} value={edu.state} onChange={e => setEdu(i, 'state', e.target.value)} maxLength={2} />
            </Field>
            <Field label="Major / Field of Study">
              <input className={inputCls} value={edu.major} onChange={e => setEdu(i, 'major', e.target.value)} />
            </Field>
            <Field label="Years Attended">
              <input className={inputCls} value={edu.yearsAttended} onChange={e => setEdu(i, 'yearsAttended', e.target.value)} placeholder="e.g. 2018–2022" />
            </Field>
            <Field label="Degree / Diploma Earned">
              <input className={inputCls} value={edu.degree} onChange={e => setEdu(i, 'degree', e.target.value)} />
            </Field>
            <Field label="Last Year Attended">
              <input className={inputCls} value={edu.lastYear} onChange={e => setEdu(i, 'lastYear', e.target.value)} placeholder="e.g. 2022" maxLength={4} />
            </Field>
          </div>
        </div>
      ))}
      {form.education.length < 3 && (
        <button
          type="button"
          className="text-sm text-red-700 hover:underline"
          onClick={() => setForm(f => ({ ...f, education: [...f.education, emptyEdu()] }))}
        >
          + Add another institution
        </button>
      )}

      {/* section 5 work history with past employerrs */}
      <SectionHeader n={5} title="Work History" />
      {form.workHistory.map((job, i) => (
        <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-600">Employer {i + 1}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Employer Name">
              <input className={inputCls} value={job.employer} onChange={e => setWork(i, 'employer', e.target.value)} />
            </Field>
            <Field label="Position Title">
              <input className={inputCls} value={job.title} onChange={e => setWork(i, 'title', e.target.value)} />
            </Field>
            <Field label="Start Date">
              <input className={inputCls} type="month" value={job.startDate} onChange={e => setWork(i, 'startDate', e.target.value)} />
            </Field>
            <Field label="End Date">
              <input className={inputCls} type="month" value={job.endDate} onChange={e => setWork(i, 'endDate', e.target.value)} />
            </Field>
            <Field label="Supervisor Name">
              <input className={inputCls} value={job.supervisor} onChange={e => setWork(i, 'supervisor', e.target.value)} />
            </Field>
            <Field label="Reason for Leaving">
              <input className={inputCls} value={job.reasonLeaving} onChange={e => setWork(i, 'reasonLeaving', e.target.value)} />
            </Field>
          </div>
          <Field label="Duties / Responsibilities">
            <textarea className={inputCls} rows={2} value={job.duties} onChange={e => setWork(i, 'duties', e.target.value)} />
          </Field>
        </div>
      ))}
      {form.workHistory.length < 3 && (
        <button
          type="button"
          className="text-sm text-red-700 hover:underline"
          onClick={() => setForm(f => ({ ...f, workHistory: [...f.workHistory, emptyWork()] }))}
        >
          + Add another employer
        </button>
      )}

      {/* section 6 military service now required */}
      <SectionHeader n={6} title="Military Service" />
      <Field label="Have you served in the U.S. military?" required>
        <select className={selectCls} value={form.militaryServed} onChange={e => set('militaryServed', e.target.value)} required>
          <option value="">Select</option>
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>
      </Field>
      {form.militaryServed === 'yes' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Branch">
            <input className={inputCls} value={form.militaryBranch} onChange={e => set('militaryBranch', e.target.value)} />
          </Field>
          <Field label="Title / Rank">
            <input className={inputCls} value={form.militaryRank} onChange={e => set('militaryRank', e.target.value)} />
          </Field>
          <Field label="From">
            <input className={inputCls} type="month" value={form.militaryFrom} onChange={e => set('militaryFrom', e.target.value)} />
          </Field>
          <Field label="To">
            <input className={inputCls} type="month" value={form.militaryTo} onChange={e => set('militaryTo', e.target.value)} />
          </Field>
          <Field label="Immediate Supervisor">
            <input className={inputCls} value={form.militarySupervisor} onChange={e => set('militarySupervisor', e.target.value)} />
          </Field>
          <Field label="Reason for Leaving">
            <input className={inputCls} value={form.militaryReasonLeaving} onChange={e => set('militaryReasonLeaving', e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Duties">
              <textarea className={inputCls} rows={2} value={form.militaryDuties} onChange={e => set('militaryDuties', e.target.value)} />
            </Field>
          </div>
        </div>
      )}

      {/* section 7 the legal disclosure */}
      <SectionHeader n={7} title="Legal Disclosure" />
      <Field label="Have you ever been convicted of a felony?" required>
        <select className={selectCls} value={form.felonyConviction} onChange={e => set('felonyConviction', e.target.value)} required>
          <option value="">Select</option>
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>
      </Field>
      {form.felonyConviction === 'yes' && (
        <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-3">
          <p className="text-sm text-amber-800">Please provide the following details. A conviction does not automatically disqualify you from employment.</p>
          <Field label="What were you convicted of, and what were the circumstances?" required>
            <textarea
              className={inputCls}
              rows={3}
              value={form.felonyExplanation}
              onChange={e => set('felonyExplanation', e.target.value)}
              required
              placeholder="Please describe the nature of the conviction…"
            />
          </Field>
          <Field label="When did this occur?" required>
            <input
              className={inputCls}
              value={form.felonyWhen}
              onChange={e => set('felonyWhen', e.target.value)}
              required
              placeholder="e.g. January 2015"
            />
          </Field>
        </div>
      )}

      {/* equal employment opportunity statement at the bottom */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-500 mt-6">
        <strong>Equal Employment Opportunity Statement:</strong> China Rose is an equal opportunity employer. All applicants will be considered for employment without attention to race, color, religion, sex, sexual orientation, gender identity, national origin, veteran, or disability status. A conviction record does not automatically disqualify an applicant from employment.
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-red-700 hover:bg-red-800 disabled:bg-red-400 text-white font-bold py-4 rounded-xl transition-colors text-lg mt-4"
      >
        {submitting ? 'Submitting…' : 'Submit Application'}
      </button>
    </form>
  )
}
