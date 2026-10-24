import { comparisonFixture } from './fixtures/scheduled-actual'
async function main(){console.log(JSON.stringify({CR2:await comparisonFixture('CR2'),CR3:await comparisonFixture('CR3')}))}
main().catch(()=>{process.exitCode=1})
