const parse = require('csv-parser');
const fs = require('fs');
 
const processFile = async () => {
  records = []
  const parser = fs
  .createReadStream(`./aaa_1.csv`)
  .pipe(parse());
  for await (const record of parser) {
    // Work with each record
    records.push(record)
  }
  return records
}

(async () => {
  const records = await processFile()
  console.info(records);
})()