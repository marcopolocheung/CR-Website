"""FORM-02 local acceptance: write-up device drafts, navigation protection, corrupt/denied storage, immutability and no tokens.
Run against Next dev with NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787.
Usage: python3 scripts/test-forms-drafts.py http://127.0.0.1:3017
"""
import json
import sys
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect, Error

base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3017'
assert urlparse(base).hostname in ('127.0.0.1', 'localhost'), 'Local server required'
TOKEN = 'synthetic-forms-draft-token'
PREFIX = 'cr-internal-draft:'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 768, 'height': 1024}, has_touch=True)
    errors, posts, saved = [], [], {}
    mode = {'auth': True}

    def api(route):
        req = route.request
        headers = {'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization,Content-Type', 'access-control-allow-methods': 'GET,POST,PUT,OPTIONS'}
        if req.method == 'OPTIONS': return route.fulfill(status=204, headers=headers)
        if req.headers.get('authorization') != 'Bearer ' + TOKEN or not mode['auth']:
            return route.fulfill(status=401, json={'error': 'unauthorized'}, headers=headers)
        path = urlparse(req.url).path
        if path == '/api/auth/verify': return route.fulfill(status=200, json={'ok': True}, headers=headers)
        if path == '/api/writeups' and req.method == 'GET':
            rows = [{'id': i, 'date': d['form']['date'], 'employee': d['form']['employee'], 'label': d['label']} for i, d in saved.items()]
            return route.fulfill(status=200, json={'writeUps': rows}, headers=headers)
        if path == '/api/writeups' and req.method == 'POST':
            form = req.post_data_json; posts.append(form)
            wid = f'saved{len(posts):05d}'
            saved[wid] = {'v': 1, 'id': wid, 'form': form, 'label': '', 'createdAt': '2026-10-24T12:00:00.000Z', 'labelUpdatedAt': None}
            return route.fulfill(status=201, json={'id': wid, 'createdAt': '2026-10-24T12:00:00.000Z'}, headers=headers)
        wid = path.rsplit('/', 1)[-1]
        if req.method == 'GET' and wid in saved: return route.fulfill(status=200, json=saved[wid], headers=headers)
        errors.append('unexpected ' + req.method + ' ' + path); route.fulfill(status=404, json={'error': 'not_found'}, headers=headers)
    context.route('http://127.0.0.1:8787/**', api)
    context.route('https://*.workers.dev/**', lambda route: (errors.append('remote ' + route.request.url), route.abort()))
    page = context.new_page(); page.on('pageerror', lambda e: errors.append(str(e)))

    def unlock():
        page.locator('#cashout-code').fill(TOKEN)
        page.get_by_role('button', name='Unlock', exact=True).click()
        expect(page.get_by_role('button', name='New write-up', exact=True)).to_be_visible()
    def drafts():
        return page.evaluate(f'Object.entries(localStorage).filter(([k]) => k.startsWith("{PREFIX}")).map(([key, raw]) => ({{ key, raw }}))')
    def choose(store, date, preparer):
        page.get_by_role('button', name='New write-up', exact=True).click()
        page.locator('#form-draft-store').select_option(store)
        page.locator('#form-draft-date').fill(date)
        page.locator('#form-draft-preparer').fill(preparer)
    employee = lambda: page.locator('input[required][maxlength="60"]').first
    incident = lambda: page.get_by_label('Incident Descriptions', exact=True)

    page.goto(base + '/internal/forms')
    unlock()

    # Scenario 1: drafts are scoped by store, date and form type; another employee's draft is never mixed in.
    choose('CR2', '2026-10-20', 'Manager A')
    page.get_by_role('button', name='Start new draft', exact=True).tap()
    expect(page.get_by_text('Working draft · CR2 · SW Military · 2026-10-20 · Manager A')).to_be_visible()
    expect(page.locator('input[type="date"][required]')).to_have_value('2026-10-20')
    expect(page.locator('input[type="date"][required]')).to_be_disabled()
    employee().fill('Ana López')
    incident().fill('Llegó tarde.\nSecond line')
    expect(page.get_by_text('Saved on this device', exact=False)).to_be_visible()
    first = drafts()
    assert len(first) == 1, first
    value = json.loads(first[0]['raw'])
    assert value['context'] == {'task': 'form', 'formType': 'write-up', 'storeId': 'CR2', 'businessDate': '2026-10-20'}, value['context']
    assert value['payload']['form']['employee'] == 'Ana López' and value['payload']['form']['incident'] == 'Llegó tarde.\nSecond line'
    assert value['payload']['savedId'] is None and value['preparer'] == 'Manager A'

    page.get_by_role('button', name='Choose another draft', exact=True).click()
    expect(page.locator('#form-draft-preparer')).to_be_focused()
    page.locator('#form-draft-store').select_option('CR3')
    page.locator('#form-draft-preparer').fill('Manager B')
    expect(page.get_by_text('No drafts for this task, store and date.')).to_be_visible()
    page.get_by_role('button', name='Start new draft', exact=True).click()
    expect(employee()).to_have_value('')
    employee().fill('Carl')
    page.get_by_role('button', name='Choose another draft', exact=True).click()
    page.locator('#form-draft-store').select_option('CR2')
    expect(page.get_by_text('Preparer: Manager A')).to_be_visible()
    expect(page.get_by_text('Preparer: Manager B')).to_have_count(0)
    # A cash-out draft for the same store/date is a different task and never appears here.
    assert all(json.loads(d['raw'])['context']['task'] == 'form' for d in drafts())

    # Scenario 2: reload keeps the draft; leaving asks first; corrupt and denied storage are explicit.
    page.reload(); unlock()
    choose('CR2', '2026-10-20', 'Manager C')
    page.get_by_role('button', name='Resume as a copy', exact=True).click()
    expect(employee()).to_have_value('Ana López')
    expect(incident()).to_have_value('Llegó tarde.\nSecond line')
    incident().fill('Llegó tarde.\nSecond line\nThird line')
    page.evaluate("() => { const a = document.createElement('a'); a.href = '/internal/'; a.textContent = 'Leave fixture'; document.body.append(a) }")
    page.get_by_role('link', name='Leave fixture', exact=True).click()
    dialog = page.get_by_role('dialog')
    expect(dialog).to_contain_text('Your work has a copy on this device')
    page.keyboard.press('Escape')
    expect(incident()).to_have_value('Llegó tarde.\nSecond line\nThird line')
    assert '/internal/forms' in page.url
    unload = []
    page.once('dialog', lambda d: (unload.append(d.type), d.dismiss()))
    try: page.reload(timeout=5000)
    except Error: pass
    assert unload == ['beforeunload'], unload
    expect(incident()).to_have_value('Llegó tarde.\nSecond line\nThird line')

    # Second tab edits its own copy; the first tab's fields are not replaced.
    other = context.new_page(); other.on('pageerror', lambda e: errors.append(str(e)))
    other.goto(base + '/internal/forms')
    other.locator('#cashout-code').fill(TOKEN); other.get_by_role('button', name='Unlock', exact=True).click()
    other.get_by_role('button', name='New write-up', exact=True).click()
    other.locator('#form-draft-store').select_option('CR2'); other.locator('#form-draft-date').fill('2026-10-20'); other.locator('#form-draft-preparer').fill('Tab two')
    other.get_by_role('button', name='Resume as a copy', exact=True).first.click()
    other.locator('input[required][maxlength="60"]').first.fill('Other tab edit')
    expect(employee()).to_have_value('Ana López')
    other.close()

    # Storage denied: the editor keeps the values and says the device copy failed.
    page.evaluate('() => { window.realSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException("quota", "QuotaExceededError") } }')
    incident().fill('Typed while storage is full')
    expect(page.get_by_text('Draft storage is unavailable', exact=False).first).to_be_visible()
    expect(incident()).to_have_value('Typed while storage is full')
    page.get_by_role('button', name='Choose another draft', exact=True).click()
    expect(incident()).to_have_value('Typed while storage is full')  # cannot leave until the device copy saves
    page.evaluate('() => { Storage.prototype.setItem = window.realSetItem }')
    incident().fill('Typed after storage returned')
    expect(page.get_by_text('Saved on this device', exact=False)).to_be_visible()

    # Corrupt source stays downloadable and untouched.
    cr2 = next(d['key'] for d in drafts() if json.loads(d['raw'])['context'] == {'task': 'form', 'formType': 'write-up', 'storeId': 'CR2', 'businessDate': '2026-10-20'})
    corrupt_key = cr2.rsplit(':', 1)[0] + ':corrupt-fixture'
    page.evaluate('([k, v]) => localStorage.setItem(k, v)', [corrupt_key, '{broken write-up'])
    page.get_by_role('button', name='Choose another draft', exact=True).click()
    page.get_by_role('button', name='Refresh drafts', exact=True).click()
    expect(page.get_by_text('This draft could not be read.', exact=False)).to_be_visible()
    with page.expect_download() as dl:
        page.locator('li', has_text='This draft could not be read.').get_by_role('button', name='Download original source', exact=True).click()
    assert open(dl.value.path()).read() == '{broken write-up'
    assert page.evaluate('(k) => localStorage.getItem(k)', corrupt_key) == '{broken write-up'

    # Expired code while editing: the editor stays behind the gate and comes back intact.
    page.locator('#form-draft-preparer').fill('Manager D')
    page.get_by_role('button', name='Start new draft', exact=True).click()
    employee().fill('Dana')
    incident().fill('Kept through an expired code')
    mode['auth'] = False
    page.get_by_role('button', name='Save write-up', exact=True).click()
    expect(page.locator('#cashout-code')).to_be_visible()
    mode['auth'] = True
    page.locator('#cashout-code').fill(TOKEN); page.get_by_role('button', name='Unlock', exact=True).click()
    expect(incident()).to_have_value('Kept through an expired code')
    assert posts == []

    # Scenario 3: saving creates an immutable record once; the draft remembers it and resuming warns before a second record.
    page.get_by_role('button', name='Save write-up', exact=True).click()
    expect(page.get_by_text('Saved.', exact=True)).to_be_visible()
    assert len(posts) == 1 and posts[0]['employee'] == 'Dana' and posts[0]['date'] == '2026-10-20'
    expect(page.get_by_label('Incident Descriptions', exact=True)).to_be_disabled()
    dana = [json.loads(d['raw']) for d in drafts() if d['raw'].startswith('{') and 'Dana' in d['raw']]
    assert len(dana) == 1 and dana[0]['payload']['savedId'] == 'saved00001', dana
    page.get_by_role('button', name='Back to list', exact=True).click()
    choose('CR2', '2026-10-20', 'Manager E')
    resume = page.locator('li', has_text='Preparer: Manager D').get_by_role('button', name='Resume as a copy', exact=True)
    resume.click()
    expect(page.get_by_text('This draft was already saved as a write-up.', exact=False)).to_be_visible()
    expect(page.get_by_role('button', name='Save write-up', exact=True)).to_be_disabled()
    page.get_by_role('button', name='Edit as a new write-up', exact=True).click()
    expect(page.get_by_role('button', name='Save write-up', exact=True)).to_be_enabled()
    assert len(posts) == 1, 'Resuming a saved draft must not create another record by itself'
    assert saved['saved00001']['form']['incident'] == 'Kept through an expired code'

    # No token or code ever lands in storage or a recovery download.
    everything = page.evaluate('JSON.stringify(Object.entries(localStorage))')
    assert TOKEN not in everything and 'Bearer' not in everything
    with page.expect_download() as dl:
        page.get_by_role('button', name='Download this working copy', exact=True).click()
    assert TOKEN not in open(dl.value.path()).read()

    # Spanish keeps the same draft and values.
    before = drafts()
    page.get_by_role('button', name='Español', exact=True).click()
    expect(page.get_by_role('button', name='Elegir otro borrador', exact=True)).to_be_visible()
    expect(employee()).to_have_value('Dana')
    expect(incident()).to_have_value('Kept through an expired code')
    after = drafts()
    # Compare by key: storage order shifts when the language preference is written.
    assert {d['key']: d['raw'] for d in after} == {d['key']: d['raw'] for d in before}, 'Switching language changed a stored draft'
    page.get_by_role('button', name='English', exact=True).click()

    assert not errors, errors
    browser.close()
print('PASS: FORM-02 scoped write-up drafts, reload/leave protection, storage failure, immutability and credential-free copies')
