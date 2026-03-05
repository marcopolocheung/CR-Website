import Image from 'next/image'

interface Props {
  name: string
  addressLines: string[]
  phone: string
  phoneHref: string
  toastUrl: string
  uberUrl: string
  mapImage: string
  menuNote?: string
}

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
const MENU_IMAGES = [`${BASE}/imgs/menu1.jpg`, `${BASE}/imgs/menu2.jpg`, `${BASE}/imgs/menu3.jpg`]

export default function LocationPageContent({
  name, addressLines, phone, phoneHref, toastUrl, uberUrl, mapImage, menuNote,
}: Props) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-10">

      {/* location namme and header text */}
      <div>
        <h1 className="text-3xl font-bold text-red-800">{name}</h1>
        <p className="text-gray-500 mt-1">San Antonio, TX</p>
      </div>

      {/* address info and hours on the left with the map on the right */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div>
            <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-1">Address</h2>
            {addressLines.map((l, i) => <p key={i}>{l}</p>)}
          </div>
          <div>
            <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-1">Phone</h2>
            <a href={phoneHref} className="text-red-700 font-medium hover:underline">{phone}</a>
          </div>
          <div>
            <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-1">Hours</h2>
            <p className="text-gray-600 text-sm">Mon – Thu: 10:30 AM – 9:30 PM</p>
            <p className="text-gray-600 text-sm">Fri – Sat: 10:30 AM – 10:00 PM</p>
            <p className="text-gray-600 text-sm">Sunday: 11:00 AM – 9:30 PM</p>
          </div>
        </div>

        <div className="rounded-xl overflow-hidden shadow-md">
          <Image
            src={`${BASE}${mapImage}`}
            alt={`${name} location map`}
            width={800}
            height={600}
            className="w-full h-auto"
          />
        </div>
      </div>

      {/* menu section with images and the order buttons */}
      <section>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Menu</h2>

        {/* on mobile the order buttons go above the menu so they dont get buried */}
        <div className="flex flex-col gap-3 mb-4 md:hidden">
          <a
            href={toastUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-center bg-red-700 hover:bg-red-800 text-white font-bold py-3 px-4 rounded-xl transition-colors"
          >
            Order Pick-Up
          </a>
          <a
            href={uberUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-center bg-gray-800 hover:bg-gray-900 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
          >
            Order Delivery
          </a>
        </div>

        {/* on larger screens the menu and buttons are side by side i thinkk its easier that way */}
        <div className="flex gap-5 items-start">
          {/* the scrollable columm where all the menu images stack up */}
          <div className="flex-1 overflow-y-auto max-h-[60vh] space-y-3 pr-1 rounded-lg">
            {MENU_IMAGES.map((src, i) => (
              <div key={i} className="rounded-xl overflow-hidden shadow-sm">
                <Image
                  src={src}
                  alt={`Menu page ${i + 1}`}
                  width={900}
                  height={675}
                  className="w-full h-auto"
                />
              </div>
            ))}
            {menuNote && <p className="text-xs text-gray-400 pt-1">{menuNote}</p>}
          </div>

          {/* desktop only order buttons to the right of the menu */}
          <div className="hidden md:flex flex-col gap-3 w-44 shrink-0">
            <a
              href={toastUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-center bg-red-700 hover:bg-red-800 text-white font-bold py-3 px-3 rounded-xl transition-colors text-sm"
            >
              Order Pick-Up
            </a>
            <a
              href={uberUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-center bg-gray-800 hover:bg-gray-900 text-white font-semibold py-3 px-3 rounded-xl transition-colors text-sm"
            >
              Order Delivery
            </a>
          </div>
        </div>
      </section>

    </div>
  )
}
