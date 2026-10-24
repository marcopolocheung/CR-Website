"""IMPORT-05 browser acceptance using loopback only and synthetic rows."""
import sys, csv, io, tempfile, zipfile
from pathlib import Path
from urllib.parse import urlparse
from xml.etree import ElementTree as ET
from playwright.sync_api import sync_playwright, expect
from import_browser_helpers import set_source
BASE=sys.argv[1]
assert urlparse(BASE).hostname in ('127.0.0.1','localhost')
headers=['Employee External Id','Employee','Job Title','In Date','Out Date','Total Hours','Regular Hours','Overtime Hours']
def source(rows):
 s=io.StringIO();w=csv.writer(s);w.writerow(headers);w.writerow([]);w.writerows(rows)
 return {'name':'preview.csv','mimeType':'text/csv','buffer':s.getvalue().encode()}
def run():
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True);context=browser.new_context(viewport={'width':390,'height':844},has_touch=True,accept_downloads=True)
  errors=[];remote=[]
  context.route('http://127.0.0.1:8787/**',lambda r:r.fulfill(status=200,json={'days':[]},headers={'access-control-allow-origin':'*'}))
  def reject(r):remote.append(r.request.url);r.abort()
  context.route('https://*.workers.dev/**',reject)
  page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE+'/internal/bookkeeping/');page.wait_for_load_state('networkidle');page.locator('#tab-hours').tap()
  page.locator('#hc-location').select_option(index=1);page.locator('#hc-start').fill('2026-10-24');page.locator('#hc-end').fill('2026-10-24')
  normal=['e1','Synthetic','Cook','10/24/2026 11:00 PM','10/25/2026 02:00 AM','3','2.5','0.5']
  missing=normal.copy();missing[0]=''
  set_source(page,'#hc-file',source([missing]));expect(page.locator('[data-hours-row="3"]')).to_contain_text('Missing employee name or external ID')
  page.locator('#hours-reviewed').check();expect(page.locator('#hc-download')).to_be_disabled()
  outside=normal.copy();outside[3]='10/25/2026 12:00 AM'
  open_punch=normal.copy();open_punch[4]=''
  bad=normal.copy();bad[3]='02/30/2026 08:00 AM'
  set_source(page,'#hc-file',source([normal,outside,open_punch,bad]))
  expect(page.locator('#panel-hours')).to_contain_text('4 source rows · 1 included · 3 excluded')
  expect(page.locator('[data-hours-row="3"]')).to_contain_text('Included')
  expect(page.locator('[data-hours-row="4"]')).to_contain_text('outside the selected period')
  expect(page.locator('[data-hours-row="5"]')).to_contain_text('Open punch')
  expect(page.locator('[data-hours-row="6"]')).to_contain_text('Invalid or unsupported timestamp')
  expect(page.locator('#hc-download')).to_be_disabled();page.locator('#hours-reviewed').focus();page.keyboard.press('Space')
  with page.expect_download() as event:page.locator('#hc-download').tap()
  with tempfile.TemporaryDirectory() as temp:
   path=Path(temp)/'hours.xlsx';event.value.save_as(path)
   with zipfile.ZipFile(path) as z:
    root=ET.fromstring(z.read('xl/worksheets/sheet1.xml'));ns={'x':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    for cell,expected in [('F2','3'),('G2','2.5'),('H2','0.5')]:assert root.find(f'.//x:c[@r="{cell}"]/x:v',ns).text==expected
  page.locator('#hc-end').fill('2026-10-25');expect(page.locator('#hours-reviewed')).not_to_be_checked()
  expect(page.locator('#panel-hours')).to_contain_text('4 source rows · 2 included · 2 excluded')
  page.get_by_role('button',name='Español',exact=True).tap();expect(page.locator('#hours-review-title')).to_have_text('Revisar horas del personal')
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
  assert not errors,errors;assert not remote,remote
  context.close();browser.close();print('PASS IMPORT-05: physical source rows, identity gate, overnight inclusive filtering, visible open/bad/excluded rows, unchanged source regular/overtime workbook cells, acknowledgement invalidation, Spanish phone/keyboard/touch')
if __name__=='__main__':run()
