const crypto = require('crypto');
const fs = require('fs');

const fileBuffer = fs.readFileSync('Copy of Pachet_DateValide_Versiunea_2.xlsx');
const hashSum = crypto.createHash('md5');
hashSum.update(fileBuffer);

const hex = hashSum.digest('hex');

console.log(hex);