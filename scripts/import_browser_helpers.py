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

def sales_stage(page, stage):
    page.locator(f'[data-sales-go="{stage}"]').click()
    expect(page.locator('[data-sales-stage]')).to_have_attribute('data-sales-stage', stage)

def sales_report(page):
    if page.locator('[data-sales-stage]').count() and page.locator('[data-sales-stage]').get_attribute('data-sales-stage') != 'report':
        page.locator('#sc-accept').click()
        expect(page.locator('[data-sales-stage]')).to_have_attribute('data-sales-stage', 'report')
