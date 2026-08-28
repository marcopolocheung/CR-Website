'use client'
import Link from 'next/link'
import { useRef, useState } from 'react'

export default function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [locOpen, setLocOpen] = useState(false)
  const locButtonRef = useRef<HTMLButtonElement>(null)

  const linkCls = 'hover:text-yellow-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-yellow-300 transition-colors'
  const dropdownLinkCls = 'block px-4 py-3 hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-yellow-300 transition-colors'

  return (
    <nav className="bg-red-800 text-white shadow-md">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className={`text-xl font-bold tracking-wide ${linkCls}`}>
          China Rose
        </Link>

        {/* desktop nav links only shows on wider screeen sizes */}
        <ul className="hidden md:flex gap-6 text-sm font-medium">
          <li><Link href="/" className={linkCls}>Home</Link></li>

          <li
            className="relative"
            onMouseEnter={() => setLocOpen(true)}
            onMouseLeave={() => setLocOpen(false)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setLocOpen(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setLocOpen(false)
                locButtonRef.current?.focus()
              }
            }}
          >
            <button
              ref={locButtonRef}
              type="button"
              className={`cursor-pointer select-none ${linkCls}`}
              aria-expanded={locOpen}
              aria-controls="locations-menu"
              onClick={() => setLocOpen(open => !open)}
            >
              Locations ▾
            </button>
            {locOpen && (
              <ul id="locations-menu" className="absolute left-0 top-full bg-red-900 rounded shadow-lg min-w-[180px] z-50">
                <li>
                  <Link
                    href="/locations/w-military"
                    className={dropdownLinkCls}
                    onClick={() => setLocOpen(false)}
                  >
                    Military Location
                  </Link>
                </li>
                <li>
                  <Link
                    href="/locations/sw-military"
                    className={dropdownLinkCls}
                    onClick={() => setLocOpen(false)}
                  >
                    Zarzamora Location
                  </Link>
                </li>
              </ul>
            )}
          </li>

          <li><Link href="/menu" className={linkCls}>Menu</Link></li>
          <li><Link href="/careers" className={linkCls}>Careers</Link></li>
        </ul>

        {/* hamburrger button toggles the mobile nav */}
        <button
          className="md:hidden flex flex-col gap-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-yellow-300"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          <span className="w-6 h-0.5 bg-white block" />
          <span className="w-6 h-0.5 bg-white block" />
          <span className="w-6 h-0.5 bg-white block" />
        </button>
      </div>

      {/* mobile nav links that show upp when the hamburger is tapped */}
      {mobileOpen && (
        <ul className="md:hidden bg-red-900 px-4 pb-4 flex flex-col gap-2 text-sm font-medium">
          <li><Link href="/" className="block py-2 hover:text-yellow-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-300" onClick={() => setMobileOpen(false)}>Home</Link></li>
          <li><Link href="/locations/w-military" className="block py-2 hover:text-yellow-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-300" onClick={() => setMobileOpen(false)}>Military Location</Link></li>
          <li><Link href="/locations/sw-military" className="block py-2 hover:text-yellow-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-300" onClick={() => setMobileOpen(false)}>Zarzamora Location</Link></li>
          <li><Link href="/menu" className="block py-2 hover:text-yellow-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-300" onClick={() => setMobileOpen(false)}>Menu</Link></li>
          <li><Link href="/careers" className="block py-2 hover:text-yellow-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-300" onClick={() => setMobileOpen(false)}>Careers</Link></li>
        </ul>
      )}
    </nav>
  )
}
