import { comparisonFixture } from './fixtures/scheduled-actual'
import { salesFixtures } from './fixtures/imports'
import { reviewSales, type SalesSources } from '../src/lib/converter/sales-review'
import { salesContext } from '../src/lib/converter/sales-context'
import { historyData } from '../src/lib/converter/import-history'
async function main() {
 const CR2 = await comparisonFixture('CR2'), CR3 = await comparisonFixture('CR3')
 const sources = Object.fromEntries(Object.entries(salesFixtures()).map(([slot,workbook]) => [slot,{workbook,name:slot+'.xlsx'}])) as SalesSources
 const form = {firstName:'Synthetic',lastName:'Sales reviewer',date:'2026-10-20',day:'TUE',location:'CHINA ROSE #3 - 7046 W MILITARY DR',amDeposit:'0',pmDeposit:'234.56',amOverShort:'',pmOverShort:''}
 const review = reviewSales(sources,form); review.sources=review.sources.map(source=>({...source,fingerprint:'sha256:'+'a'.repeat(64)}));review.context={...salesContext(sources),reason:'Synthetic source context checked for CR3 business date.'}
 const data = await historyData({version:1,kind:'sales',review,output:{filename:'26-1020_CR3_Daily_Sales_Report.xlsx',sha256:'b'.repeat(64),base64:'UEsDBA=='}},'Synthetic Sales reviewer')
 console.log(JSON.stringify({CR2,CR3,sales:{schemaVersion:1,family:'import',id:'imp_'+data.identity,storeId:'CR3',revision:1,context:{kind:'day',businessDate:'2026-10-20'},createdAt:'2026-10-24T12:00:00.000Z',updatedAt:'2026-10-24T12:00:00.000Z',data}}))
}
main().catch(()=>{process.exitCode=1})
