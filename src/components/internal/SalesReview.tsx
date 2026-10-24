'use client'

import { useEffect, useRef } from 'react'
import { useInternalLanguage } from './InternalLanguage'
import type { SalesReview as Review } from '@/lib/converter/sales-review'

export default function SalesReview({ review, acknowledged, onAcknowledge }: { review: Review; acknowledged: boolean; onAcknowledge: (value: boolean) => void }) {
  const { t, locale } = useInternalLanguage()
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [review])
  const money = (value: number | null) => value === null ? t('salesReview.missingValue') : new Intl.NumberFormat(locale === 'es' ? 'es-US' : 'en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 20 }).format(value)
  return <section className="mt-6 border-t border-gray-200 pt-5" aria-labelledby="sales-review-title">
    <h3 ref={heading} id="sales-review-title" tabIndex={-1} className="text-lg font-semibold text-gray-900 focus-visible:outline-2 focus-visible:outline-red-700">{t('salesReview.title')}</h3>
    <p className="mt-1 text-sm text-gray-700">{t('salesReview.scope')}</p>
    <dl className="mt-3 text-sm">
      <div><dt className="inline font-semibold">{t('imports.location')}: </dt><dd className="inline break-words">{review.form.location || t('salesReview.missingValue')}</dd></div>
      <div><dt className="inline font-semibold">{t('common.date')}: </dt><dd className="inline">{review.form.date || t('salesReview.missingValue')} {review.form.day}</dd></div>
    </dl>
    <ul className="mt-3 space-y-2 text-sm text-gray-700">{review.sources.map(source => <li key={source.slot}>
      <span className="font-semibold">{t(`imports.${source.slot}`)}: </span><span className="break-all">{source.filename}</span>
      <p className="break-words">{t(source.slot === 'general' ? 'salesReview.generalDetected' : 'salesReview.categoryDetected')} · {source.sheets.join(' · ')}</p>
    </li>)}</ul>
    <h4 className="mt-5 font-semibold">{t('salesReview.figures')}</h4>
    <p className="mt-1 text-sm text-gray-600">{t('salesReview.sourceNote')}</p>
    <div className="mt-2 max-w-full overflow-x-auto" tabIndex={0} role="region" aria-label={t('salesReview.figures')}>
      <table className="w-full min-w-[38rem] border-collapse text-left text-sm">
        <thead><tr>{(['salesReview.figure', 'salesReview.value', 'salesReview.source', 'salesReview.cell'] as const).map(key => <th key={key} className="border-b border-gray-300 p-2">{t(key)}</th>)}</tr></thead>
        <tbody>{review.figures.map(figure => <tr key={figure.cell} className="align-top">
          <th scope="row" className="border-b border-gray-200 p-2 font-medium">{figure.slot !== 'form' && <span>{t(`imports.${figure.slot}`)} · </span>}{t(figure.label)}</th>
          <td className="whitespace-nowrap border-b border-gray-200 p-2">{money(figure.value)}</td>
          <td className="max-w-sm border-b border-gray-200 p-2 break-words">
            {figure.slot === 'form' ? t('salesReview.entered') : figure.absent ? t('salesReview.absent') : <>{figure.sheet} · {t('salesReview.row', { row: figure.row! })} · {figure.column}</>}
            <p>{t('salesReview.raw')}: {figure.raw === null ? t('salesReview.missingValue') : String(figure.raw)}</p>
          </td>
          <td className="border-b border-gray-200 p-2 font-mono">{figure.cell}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <h4 className="mt-5 font-semibold">{t('salesReview.checks')}</h4>
    <p className="mt-1 text-sm text-gray-600">{t('salesReview.checkNote')}</p>
    <ul className="mt-3 space-y-3">{review.checks.map(check => <li key={check.id} data-sales-check={check.id} className={`border-l-4 pl-3 text-sm ${check.state === 'match' ? 'border-green-600' : 'border-amber-500'}`}>
      <p className="font-semibold">{t(check.label)} · {t(`salesReview.${check.state}`)}</p>
      <p>{t('salesReview.comparison', { left: money(check.left), right: money(check.right), difference: money(check.difference) })}</p>
    </li>)}</ul>
    {!!review.unmapped.length && <div role="alert" className="mt-4 rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950">
      <p className="font-semibold">{t('salesReview.unmapped')}</p>
      <ul>{review.unmapped.map(payment => <li key={payment.row}>{t('salesReview.row', { row: payment.row })} · {payment.type} · {payment.subtype} · {money(payment.value)}</li>)}</ul>
    </div>}
    {!!review.unmappedCategories.length && <div role="alert" className="mt-4 rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950">
      <p className="font-semibold">{t('salesReview.unmappedCategories')}</p>
      <ul>{review.unmappedCategories.map(category => <li key={`${category.slot}:${category.row}`}>{t(`imports.${category.slot}`)} · {t('salesReview.row', { row: category.row })} · {category.category} · {money(category.net)} · {money(category.tax)}</li>)}</ul>
    </div>}
    <label className="mt-5 flex min-h-11 cursor-pointer items-start gap-3 text-sm font-medium text-gray-900">
      <input id="sales-reviewed" type="checkbox" checked={acknowledged} onChange={event => onAcknowledge(event.target.checked)} className="mt-1 size-5 shrink-0 accent-red-700 focus-visible:outline-2 focus-visible:outline-red-700" />
      <span>{t('salesReview.acknowledge')}</span>
    </label>
  </section>
}
