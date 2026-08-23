import Link from 'next/link'
import LocationOpenStatus from './LocationOpenStatus'

export default function Footer() {
  return (
    <footer className="bg-red-900 text-white mt-auto">
      <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
        <div>
          <h2 className="font-bold text-yellow-300 mb-2">China Rose</h2>
          <p>Authentic Chinese Cuisine</p>
          <p>San Antonio, TX</p>
        </div>
        <div>
          <h2 className="font-bold text-yellow-300 mb-2">Locations</h2>
          <ul className="space-y-3">
            <li>
              <Link href="/locations/w-military" className="inline-flex flex-col hover:text-yellow-300 transition-colors">
                <span>W Military Dr</span>
                <LocationOpenStatus />
              </Link>
            </li>
            <li>
              <Link href="/locations/sw-military" className="inline-flex flex-col hover:text-yellow-300 transition-colors">
                <span>SW Military Dr</span>
                <LocationOpenStatus />
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="font-bold text-yellow-300 mb-2">Links</h2>
          <ul className="space-y-2">
            <li><Link href="/careers" className="hover:text-yellow-300 transition-colors">Careers</Link></li>
            <li>
              <a href="tel:2106753226" className="hover:text-yellow-300 transition-colors">
                W Military: (210) 675-3226
              </a>
            </li>
            <li>
              <a href="tel:2109277339" className="hover:text-yellow-300 transition-colors">
                SW Military: (210) 927-7339
              </a>
            </li>
          </ul>
          <p className="mt-3 text-xs text-red-200">
            For accessibility help, call either location.
          </p>
        </div>
      </div>
      <div className="border-t border-red-700 text-center py-3 text-xs text-red-300">
        &copy; {new Date().getFullYear()} China Rose. All rights reserved.
      </div>
    </footer>
  )
}
