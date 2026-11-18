"""Shared acceptance helpers for explicit source-replacement confirmation."""
from playwright.sync_api import expect

def confirm_replacement(page):
    dialog = page.get_by_role('dialog')
    expect(dialog).to_be_visible()
    dialog.locator('button').last.click()

def set_source(page, selector, payload):
    control = page.locator(selector)
    replacement = control.get_attribute('data-has-file') == 'true'
    if str(selector).startswith('#sc-file') and page.locator('#sales-review-title').count():
        replacement = True
    control.set_input_files(payload)
    if replacement:
        confirm_replacement(page)

def hours_stage(page, stage):
    page.locator(f'[data-hours-go="{stage}"]').click()
    expect(page.locator('[data-hours-stage]')).to_have_attribute('data-hours-stage', stage)

def hours_review(page, details=False):
    if page.locator('[data-hours-stage]').count() and page.locator('[data-hours-stage]').get_attribute('data-hours-stage') != 'review':
        page.locator('#hc-prepare').click()
    if details and page.locator('#hours-source-details').get_attribute('open') is None:
        page.locator('#hours-source-details > summary').click()

def hours_report(page):
    if page.locator('[data-hours-stage]').count() and page.locator('[data-hours-stage]').get_attribute('data-hours-stage') != 'report':
        page.locator('#hc-accept').click()
        expect(page.locator('[data-hours-stage]')).to_have_attribute('data-hours-stage', 'report')

def hours_copies(page):
    detail=page.locator('[data-hours-copies]')
    if detail.get_attribute('open') is None:
        detail.locator(':scope > summary').click()
